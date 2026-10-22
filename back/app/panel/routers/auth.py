from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AdminRole
from app.panel.clock import Clock
from app.panel.permissions import ROLE_PERMISSIONS
from app.panel.principal import Principal
from app.panel.schemas.auth import AdminRead, PasswordUpdate, SessionCreate, SessionRead
from app.panel.security import (
    COOKIE_PATH,
    SESSION_COOKIE,
    authenticate,
    client_network,
    enforce_login_rate_limit,
    require_trusted_origin,
)
from app.panel.services import auth as service
from app.panel.services.secret_box import SecretBox
from app.panel.services.sessions import SessionTimes
from app.panel.state import get_box, get_clock, get_session_times
from app.rate_limit import enforce_rate_limit

router = APIRouter(prefix="/api/admin", tags=["session"], dependencies=[Depends(enforce_rate_limit)])


def read_admin(email: str, display_name: str, role: str) -> AdminRead:
    permissions = ROLE_PERMISSIONS.get(AdminRole(role), frozenset())
    return AdminRead(
        email=email,
        display_name=display_name,
        role=role,
        permissions=sorted(permission.value for permission in permissions),
    )


def read_session(admin: AdminRead, csrf_token: str, times: SessionTimes) -> SessionRead:
    return SessionRead(
        admin=admin, csrf_token=csrf_token, idle_timeout_seconds=int(times.idle.total_seconds())
    )


@router.post(
    "/sessions",
    status_code=status.HTTP_201_CREATED,
    response_model=SessionRead,
    dependencies=[Depends(enforce_login_rate_limit), Depends(require_trusted_origin)],
)
def sign_in(
    data: SessionCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
    box: SecretBox = Depends(get_box),
    times: SessionTimes = Depends(get_session_times),
) -> SessionRead:
    signed_in = service.sign_in(
        db,
        service.Credentials(email=data.email, password=data.password, code=data.code),
        service.SignInContext(now=clock(), network=client_network(request), box=box, times=times),
    )
    response.set_cookie(
        SESSION_COOKIE, signed_in.token, httponly=True, secure=True, samesite="strict", path=COOKIE_PATH
    )
    admin = signed_in.admin
    return read_session(read_admin(admin.email, admin.display_name, admin.role), signed_in.csrf_token, times)


@router.get("/sessions/current", response_model=SessionRead)
def current_session(
    principal: Principal = Depends(authenticate), times: SessionTimes = Depends(get_session_times)
) -> SessionRead:
    admin = read_admin(principal.email, principal.display_name, principal.role)
    return read_session(admin, principal.csrf_token, times)


@router.delete("/sessions/current", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(
    principal: Principal = Depends(authenticate),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> Response:
    service.sign_out(db, principal.actor, principal.session_id, clock())
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(SESSION_COOKIE, httponly=True, secure=True, samesite="strict", path=COOKIE_PATH)
    return response


@router.put(
    "/account/password",
    status_code=status.HTTP_204_NO_CONTENT,
    # A password is checked here too, so the sign-in's own, stricter limit applies.
    dependencies=[Depends(enforce_login_rate_limit)],
)
def change_password(
    data: PasswordUpdate,
    principal: Principal = Depends(authenticate),
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
) -> None:
    service.change_password(
        db, principal, service.PasswordChange(current=data.current_password, new=data.new_password), clock()
    )
