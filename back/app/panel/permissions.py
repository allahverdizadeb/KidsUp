"""What each role of the admin panel may do (SEC-B-04).

Default deny: a permission that is not listed for a role is not held, and a role the code does not know holds
nothing. Roles are least-privilege: a viewer reads, a coordinator also works on applications, an admin also
exports, deletes and runs the site.
"""

from enum import StrEnum

from app.models import AdminRole


class Permission(StrEnum):
    DASHBOARD_READ = "dashboard:read"
    APPLICATIONS_READ = "applications:read"
    APPLICATIONS_UPDATE = "applications:update"  # change the status, write a note
    APPLICATIONS_EXPORT = "applications:export"
    APPLICATIONS_DELETE = "applications:delete"  # an erasure at a parent's request, or a note taken back
    COURSES_READ = "courses:read"
    COURSES_WRITE = "courses:write"
    CONTENT_MANAGE = "content:manage"  # the landing page: texts, images, publishing
    AUDIT_READ = "audit:read"
    USERS_READ = "users:read"  # who has access to the panel (names, e-mail addresses, roles); admins only


VIEWER = frozenset({Permission.DASHBOARD_READ, Permission.APPLICATIONS_READ, Permission.COURSES_READ})
COORDINATOR = VIEWER | {Permission.APPLICATIONS_UPDATE}

ROLE_PERMISSIONS: dict[AdminRole, frozenset[Permission]] = {
    AdminRole.VIEWER: VIEWER,
    AdminRole.COORDINATOR: COORDINATOR,
    AdminRole.ADMIN: frozenset(Permission),
}


def has_permission(role: str, permission: Permission) -> bool:
    try:
        known_role = AdminRole(role)
    except ValueError:
        return False
    return permission in ROLE_PERMISSIONS[known_role]
