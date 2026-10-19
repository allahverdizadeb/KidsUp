"""SEC-B-07, SEC-B-14: the API refuses to run as anything but the limited account.

The settings can only look at an account's name; this asks the database what the account can really do.
"""

import pytest
from psycopg import sql
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.bootstrap import connect
from app.privileges import require_least_privilege
from app.schemas.application import ApplicationCreate
from app.services import applications as service
from tests.scratch import APP_ROLE, RETENTION_ROLE, TEST_URL
from tests.test_applications import VALID


def test_a_superuser_is_refused():
    with pytest.raises(RuntimeError, match=r"administrative attributes \(rolsuper"):
        require_least_privilege(create_engine(TEST_URL))


@pytest.mark.parametrize(
    ("attribute", "column"),
    [
        ("CREATEDB", "rolcreatedb"),
        ("CREATEROLE", "rolcreaterole"),
        ("REPLICATION", "rolreplication"),
        ("BYPASSRLS", "rolbypassrls"),
    ],
)
def test_each_administrative_attribute_is_refused(provisioned, attribute, column):
    with connect(provisioned.admin) as conn:
        conn.execute(sql.SQL("ALTER ROLE {} " + attribute).format(sql.Identifier(APP_ROLE)))

    with pytest.raises(RuntimeError, match=column):
        require_least_privilege(create_engine(provisioned.app))


def test_the_limited_api_account_is_accepted(provisioned):
    require_least_privilege(create_engine(provisioned.app))


@pytest.mark.parametrize(
    ("privilege", "named"),
    [
        ("SELECT", "SELECT"),
        ("UPDATE", "UPDATE"),
        ("DELETE", "DELETE"),
        ("TRUNCATE", "TRUNCATE"),
        ("REFERENCES", "REFERENCES"),
        ("TRIGGER", "TRIGGER"),
        ("SELECT (created_at)", "SELECT"),  # reading even one column back is too much
        ("UPDATE (status)", "UPDATE"),
    ],
)
def test_a_privilege_the_api_has_no_use_for_is_refused(provisioned, privilege, named):
    with connect(provisioned.admin) as conn:
        conn.execute(
            sql.SQL("GRANT {} ON TABLE public.applications TO {}").format(
                sql.SQL(privilege), sql.Identifier(APP_ROLE)
            )
        )

    with pytest.raises(RuntimeError, match=named):
        require_least_privilege(create_engine(provisioned.app))


def test_the_retention_account_is_not_an_acceptable_api_account(provisioned):
    # It can delete: configured by mistake as the API's account, it would be caught at start-up.
    with pytest.raises(RuntimeError, match="DELETE"):
        require_least_privilege(create_engine(provisioned.retention))
    assert RETENTION_ROLE in provisioned.retention.render_as_string()


def test_the_api_stores_an_application_with_nothing_but_the_limited_account(provisioned):
    # The API's real code path (the ORM insert, RETURNING the creation time) as the limited account.
    # Like SessionLocal, it must not expire the object on commit: reading it back would need a SELECT right.
    api_session = sessionmaker(
        bind=create_engine(provisioned.app, hide_parameters=True), expire_on_commit=False
    )
    with api_session() as db:
        application = service.create_application(db, ApplicationCreate.model_validate(VALID))
        stored_id = application.id

    with connect(provisioned.admin) as conn:
        assert conn.execute("SELECT id FROM applications").fetchall() == [(stored_id,)]
        assert conn.execute("SELECT count(*) FROM application_children").fetchone() == (1,)
