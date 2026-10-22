"""SEC-B-07, SEC-B-14: each service refuses to run as anything but the account it was made for.

The settings can only look at an account's name; this asks the database what the account can really do.
"""

import pytest
from psycopg import sql
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.bootstrap import connect
from app.privileges import require_least_privilege, require_panel_privileges
from app.schemas.application import ApplicationCreate
from app.services import applications as service
from tests.scratch import APP_ROLE, PANEL_ROLE, SCRATCH_DATABASE, TEST_URL
from tests.test_applications import VALID


def grant_to_the_api_account(provisioned, statement: str) -> None:
    """Runs e.g. "GRANT SELECT ON TABLE public.applications TO {role}" as superuser, for the API role."""
    with connect(provisioned.admin) as conn:
        conn.execute(sql.SQL(statement).format(role=sql.Identifier(APP_ROLE)))


def test_a_superuser_is_refused():
    with pytest.raises(RuntimeError, match="administrative attribute rolsuper"):
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
    grant_to_the_api_account(provisioned, "ALTER ROLE {role} " + attribute)

    with pytest.raises(RuntimeError, match=column):
        require_least_privilege(create_engine(provisioned.app))


def test_the_insert_only_api_account_is_accepted(provisioned):
    require_least_privilege(create_engine(provisioned.app))


@pytest.mark.parametrize(
    ("grant", "named"),
    [
        ("SELECT ON TABLE public.applications", "SELECT public.applications"),
        ("UPDATE ON TABLE public.applications", "UPDATE public.applications"),
        ("DELETE ON TABLE public.applications", "DELETE public.applications"),
        ("TRUNCATE ON TABLE public.applications", "TRUNCATE public.applications"),
        ("REFERENCES ON TABLE public.applications", "REFERENCES public.applications"),
        ("TRIGGER ON TABLE public.applications", "TRIGGER public.applications"),
        (
            "SELECT (created_at) ON TABLE public.applications",
            "SELECT public.applications",
        ),  # one column is too much
        ("UPDATE (status) ON TABLE public.applications", "UPDATE public.applications"),
        (
            "SELECT ON TABLE public.application_children",
            "SELECT public.application_children",
        ),  # names, birth dates
        ("DELETE ON TABLE public.application_children", "DELETE public.application_children"),
        ("SELECT ON TABLE public.alembic_version", "SELECT public.alembic_version"),
        # INSERT too: only the two tables of the form, and only the columns the form fills in (SEC-B-07).
        ("INSERT ON TABLE public.audit_log", "INSERT public.audit_log"),  # forged history
        ("INSERT ON TABLE public.courses", "INSERT public.courses"),
        ("INSERT ON TABLE public.application_notes", "INSERT public.application_notes"),
        ("INSERT ON TABLE public.admin_users", "INSERT public.admin_users"),
        ("INSERT ON TABLE public.admin_sessions", "INSERT public.admin_sessions"),
        ("INSERT ON TABLE public.site_content", "INSERT public.site_content"),
        ("INSERT ON TABLE public.site_publications", "INSERT public.site_publications"),
        ("INSERT ON TABLE public.media_assets", "INSERT public.media_assets"),
        ("INSERT ON TABLE public.alembic_version", "INSERT public.alembic_version"),
        ("INSERT (status) ON TABLE public.applications", r"INSERT public\.applications \(status\)"),
        ("INSERT (status_changed_at) ON TABLE public.applications", "INSERT public.applications"),
        ("INSERT (created_at) ON TABLE public.applications", r"INSERT public\.applications \(created_at\)"),
        ("INSERT ON TABLE public.applications", "INSERT public.applications"),  # every column at once
    ],
)
def test_a_right_on_any_table_the_api_has_no_use_for_is_refused(provisioned, grant, named):
    grant_to_the_api_account(provisioned, f"GRANT {grant} TO {{role}}")

    with pytest.raises(RuntimeError, match=named):
        require_least_privilege(create_engine(provisioned.app))


def test_the_right_to_create_objects_in_the_schema_is_refused(provisioned):
    grant_to_the_api_account(provisioned, "GRANT CREATE ON SCHEMA public TO {role}")

    with pytest.raises(RuntimeError, match="create objects in the schema public"):
        require_least_privilege(create_engine(provisioned.app))


def test_the_right_to_create_schemas_in_the_database_is_refused(provisioned):
    grant_to_the_api_account(provisioned, f"GRANT CREATE ON DATABASE {SCRATCH_DATABASE} TO {{role}}")

    with pytest.raises(RuntimeError, match="create schemas in the database"):
        require_least_privilege(create_engine(provisioned.app))


@pytest.mark.parametrize("granted_role", ["pg_read_server_files", "pg_read_all_data", "pg_monitor"])
def test_membership_of_any_other_role_is_refused(provisioned, granted_role):
    grant_to_the_api_account(provisioned, f"GRANT {granted_role} TO {{role}}")

    with pytest.raises(RuntimeError, match="member of another role"):
        require_least_privilege(create_engine(provisioned.app))


@pytest.mark.parametrize(
    ("revoke", "named"),
    [
        ("INSERT ON TABLE public.application_children", r"may not INSERT public\.application_children"),
        (
            "INSERT (parent_name) ON TABLE public.applications",
            r"may not INSERT public\.applications \(parent",
        ),
        (
            "INSERT (course_id) ON TABLE public.applications",
            r"may not INSERT public\.applications \(course_id",
        ),
    ],
)
def test_an_account_that_cannot_insert_what_the_form_sends_is_refused_because_no_application_could_be_stored(
    provisioned, revoke, named
):
    grant_to_the_api_account(provisioned, f"REVOKE {revoke} FROM {{role}}")

    with pytest.raises(RuntimeError, match=named):
        require_least_privilege(create_engine(provisioned.app))


def test_the_right_to_create_temporary_tables_is_refused(provisioned):
    grant_to_the_api_account(provisioned, f"GRANT TEMPORARY ON DATABASE {SCRATCH_DATABASE} TO {{role}}")

    with pytest.raises(RuntimeError, match="create temporary tables"):
        require_least_privilege(create_engine(provisioned.app))


def test_the_retention_account_is_not_an_acceptable_api_account(provisioned):
    # It can delete and cannot insert: set by mistake as the API's account, it is caught at start-up.
    with pytest.raises(RuntimeError, match=r"DELETE public\.applications"):
        require_least_privilege(create_engine(provisioned.retention))


def test_the_api_stores_an_application_with_nothing_but_the_limited_account(provisioned):
    # The API's real code path (the ORM insert, which reads nothing back) as the limited account.
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


# --- the admin panel's account must hold exactly the rights of PANEL_GRANTS


def grant_to_the_panel_account(provisioned, statement: str) -> None:
    with connect(provisioned.admin) as conn:
        conn.execute(sql.SQL(statement).format(role=sql.Identifier(PANEL_ROLE)))


def test_the_panel_account_made_by_bootstrap_is_accepted(provisioned):
    require_panel_privileges(create_engine(provisioned.panel))


def test_a_superuser_is_refused_as_the_panel_account():
    with pytest.raises(RuntimeError, match="administrative attribute rolsuper"):
        require_panel_privileges(create_engine(TEST_URL))


@pytest.mark.parametrize(
    ("attribute", "column"),
    [("CREATEDB", "rolcreatedb"), ("CREATEROLE", "rolcreaterole"), ("BYPASSRLS", "rolbypassrls")],
)
def test_an_administrative_attribute_is_refused_as_the_panel_account(provisioned, attribute, column):
    grant_to_the_panel_account(provisioned, "ALTER ROLE {role} " + attribute)

    with pytest.raises(RuntimeError, match=column):
        require_panel_privileges(create_engine(provisioned.panel))


@pytest.mark.parametrize("granted_role", ["pg_read_all_data", "pg_write_all_data"])
def test_membership_of_another_role_is_refused_as_the_panel_account(provisioned, granted_role):
    grant_to_the_panel_account(provisioned, f"GRANT {granted_role} TO {{role}}")

    with pytest.raises(RuntimeError, match="member of another role"):
        require_panel_privileges(create_engine(provisioned.panel))


def test_the_right_to_create_objects_is_refused_as_the_panel_account(provisioned):
    grant_to_the_panel_account(provisioned, "GRANT CREATE ON SCHEMA public TO {role}")

    with pytest.raises(RuntimeError, match="create objects in the schema public"):
        require_panel_privileges(create_engine(provisioned.panel))


def test_the_right_to_create_temporary_tables_is_refused_as_the_panel_account(provisioned):
    grant_to_the_panel_account(provisioned, f"GRANT TEMPORARY ON DATABASE {SCRATCH_DATABASE} TO {{role}}")

    with pytest.raises(RuntimeError, match="create temporary tables"):
        require_panel_privileges(create_engine(provisioned.panel))


@pytest.mark.parametrize(
    ("grant", "named"),
    [
        ("UPDATE ON TABLE public.audit_log", r"may UPDATE public\.audit_log"),  # the log is append-only
        ("DELETE ON TABLE public.audit_log", r"may DELETE public\.audit_log"),
        ("TRUNCATE ON TABLE public.audit_log", r"may TRUNCATE public\.audit_log"),
        (
            "UPDATE (parent_name) ON TABLE public.applications",
            r"may UPDATE public\.applications \(parent_name\)",
        ),
        ("UPDATE (consent_given_at) ON TABLE public.applications", r"may UPDATE public\.applications"),
        ("INSERT ON TABLE public.applications", r"may INSERT public\.applications"),
        ("DELETE ON TABLE public.application_children", r"may DELETE public\.application_children"),
        ("UPDATE ON TABLE public.application_children", r"may UPDATE public\.application_children"),
        ("DELETE ON TABLE public.admin_users", r"may DELETE public\.admin_users"),
        ("UPDATE (email) ON TABLE public.admin_users", r"may UPDATE public\.admin_users \(email\)"),
        ("UPDATE ON TABLE public.site_publications", r"may UPDATE public\.site_publications"),
        ("SELECT ON TABLE public.alembic_version", r"may SELECT public\.alembic_version"),
        ("REFERENCES ON TABLE public.courses", r"may REFERENCES public\.courses"),
        ("TRIGGER ON TABLE public.courses", r"may TRIGGER public\.courses"),
    ],
)
def test_a_right_the_panel_was_not_granted_is_refused(provisioned, grant, named):
    grant_to_the_panel_account(provisioned, f"GRANT {grant} TO {{role}}")

    with pytest.raises(RuntimeError, match=named):
        require_panel_privileges(create_engine(provisioned.panel))


@pytest.mark.parametrize(
    ("revoke", "named"),
    [
        ("INSERT ON TABLE public.audit_log", r"may not INSERT public\.audit_log"),
        ("SELECT ON TABLE public.applications", r"may not SELECT public\.applications"),
        ("DELETE ON TABLE public.applications", r"may not DELETE public\.applications"),
        ("UPDATE (status) ON TABLE public.applications", r"may not UPDATE public\.applications \(status\)"),
        ("INSERT ON TABLE public.admin_sessions", r"may not INSERT public\.admin_sessions"),
        ("INSERT ON TABLE public.site_publications", r"may not INSERT public\.site_publications"),
    ],
)
def test_a_right_the_panel_needs_but_lacks_is_refused(provisioned, revoke, named):
    grant_to_the_panel_account(provisioned, f"REVOKE {revoke} FROM {{role}}")

    with pytest.raises(RuntimeError, match=named):
        require_panel_privileges(create_engine(provisioned.panel))


def test_the_public_api_account_is_not_an_acceptable_panel_account(provisioned):
    with pytest.raises(RuntimeError, match=r"may not SELECT public\.applications"):
        require_panel_privileges(create_engine(provisioned.app))


def test_the_panel_account_is_not_an_acceptable_public_api_account(provisioned):
    with pytest.raises(RuntimeError, match=r"may SELECT public\.applications"):
        require_least_privilege(create_engine(provisioned.panel))
