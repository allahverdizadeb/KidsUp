"""Start-up self-check: the API must be running as the limited account (SEC-B-07, SEC-B-14).

The settings can only look at the account's *name*. This asks the database what the account really is, so a
superuser (or an owner, or an account that can read anything back) is caught whatever it is called. The API's
account must be able to insert applications and must be able to do nothing else: nothing on any table, no
membership of another role, no right to create anything.
"""

from sqlalchemy import Engine, text

ATTRIBUTES_OF_CURRENT_ROLE = text(
    "SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolreplication "
    "FROM pg_roles WHERE rolname = current_user"
)
# Membership of any role (pg_read_server_files, pg_read_all_data, a DBA role ...) is more than INSERT-only.
ROLE_MEMBERSHIPS = text(
    "SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member "
    "WHERE r.rolname = current_user"
)
TABLES_OF_THE_APPLICATION = text(
    "SELECT format('%I.%I', schemaname, tablename) FROM pg_tables WHERE schemaname = 'public'"
)
HAS_TABLE_PRIVILEGE = text("SELECT has_table_privilege(current_user, :table, :privilege)")
HAS_ANY_COLUMN_PRIVILEGE = text("SELECT has_any_column_privilege(current_user, :table, :privilege)")
MAY_CREATE_IN_SCHEMA = text("SELECT has_schema_privilege(current_user, 'public', 'CREATE')")
MAY_CREATE_IN_DATABASE = text("SELECT has_database_privilege(current_user, current_database(), 'CREATE')")
# On every table of the application the API may not read even one column back (not even the creation
# time), nor change one; "any column" covers a privilege on the whole table as well as on a single column.
FORBIDDEN_COLUMN_PRIVILEGES = ("SELECT", "UPDATE", "REFERENCES")
FORBIDDEN_TABLE_PRIVILEGES = ("DELETE", "TRUNCATE", "TRIGGER")
# What it is for. Without these every registration would fail, so a start-up that lacks them is refused too.
TABLES_TO_INSERT_INTO = ("public.applications", "public.application_children")


def require_least_privilege(engine: Engine) -> None:
    problems: list[str] = []
    with engine.connect() as conn:
        attributes = conn.execute(ATTRIBUTES_OF_CURRENT_ROLE).mappings().one()
        problems += [
            f"it has the administrative attribute {name}" for name, held in attributes.items() if held
        ]
        if conn.scalar(ROLE_MEMBERSHIPS):
            problems.append("it is a member of another role")
        if conn.scalar(MAY_CREATE_IN_SCHEMA):
            problems.append("it may create objects in the schema public")
        if conn.scalar(MAY_CREATE_IN_DATABASE):
            problems.append("it may create schemas in the database")
        for table in conn.execute(TABLES_OF_THE_APPLICATION).scalars().all():
            for query, privileges in (
                (HAS_ANY_COLUMN_PRIVILEGE, FORBIDDEN_COLUMN_PRIVILEGES),
                (HAS_TABLE_PRIVILEGE, FORBIDDEN_TABLE_PRIVILEGES),
            ):
                problems += [
                    f"it may {privilege} {table}"
                    for privilege in privileges
                    if conn.scalar(query, {"table": table, "privilege": privilege})
                ]
        problems += [
            f"it may not INSERT into {table}, so no application could be stored"
            for table in TABLES_TO_INSERT_INTO
            if not conn.scalar(HAS_TABLE_PRIVILEGE, {"table": table, "privilege": "INSERT"})
        ]
    if problems:
        raise RuntimeError(
            "The API's database account is not the INSERT-only account it must be: "
            + "; ".join(problems)
            + "."
        )
