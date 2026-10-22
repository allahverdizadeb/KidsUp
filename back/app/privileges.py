"""Start-up self-checks: a service must run as the limited account it was made for (SEC-B-07, SEC-B-14).

The settings can only look at the account's *name*. These ask the database what the account really is, so a
superuser (or an owner, or an account that can read anything back) is caught whatever it is called.

* Both limited accounts must hold exactly the rights listed in `app/grants.py` (`APP_GRANTS`: the public API
  inserts applications and children and can do nothing else, not even read a column back; `PANEL_GRANTS`: the
  admin panel's work). More is refused, and so is less (an API that could not store an application, or a panel
  that could not do its work, is worse than one that does not start). Neither may be a member of another role
  or be allowed to create anything.
"""

from collections import defaultdict
from collections.abc import Sequence

from sqlalchemy import Connection, Engine, text

from app.grants import APP_GRANTS, PANEL_GRANTS, Grant

ATTRIBUTES_OF_CURRENT_ROLE = text(
    "SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolreplication "
    "FROM pg_roles WHERE rolname = current_user"
)
# Membership of any role (pg_read_server_files, pg_read_all_data, a DBA role ...) is more than it needs.
ROLE_MEMBERSHIPS = text(
    "SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member "
    "WHERE r.rolname = current_user"
)
MAY_CREATE_IN_SCHEMA = text("SELECT has_schema_privilege(current_user, 'public', 'CREATE')")
MAY_CREATE_IN_DATABASE = text("SELECT has_database_privilege(current_user, current_database(), 'CREATE')")
# Temporary tables live in a schema searched first; an account that can make them can shadow a table of ours.
MAY_CREATE_TEMPORARY_TABLES = text(
    "SELECT has_database_privilege(current_user, current_database(), 'TEMPORARY')"
)

# Every right of the current account on every column and table of the schema, in two queries. A privilege
# held on the whole table counts for each of its columns.
COLUMN_PRIVILEGES = text(
    "SELECT format('%I.%I', n.nspname, c.relname), a.attname, p.privilege, "
    "has_column_privilege(current_user, c.oid, a.attnum, p.privilege) "
    "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
    "JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped "
    "CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) AS p(privilege) "
    "WHERE n.nspname = 'public' AND c.relkind = 'r'"
)
TABLE_PRIVILEGES = text(
    "SELECT format('%I.%I', n.nspname, c.relname), p.privilege, "
    "has_table_privilege(current_user, c.oid, p.privilege) "
    "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
    "CROSS JOIN (VALUES ('DELETE'), ('TRUNCATE'), ('TRIGGER')) AS p(privilege) "
    "WHERE n.nspname = 'public' AND c.relkind = 'r'"
)


def problems_with_the_account_itself(conn: Connection) -> list[str]:
    """Administrative attributes, memberships and the right to create objects: refused for every account."""
    problems: list[str] = []
    attributes = conn.execute(ATTRIBUTES_OF_CURRENT_ROLE).mappings().one()
    problems += [f"it has the administrative attribute {name}" for name, held in attributes.items() if held]
    if conn.scalar(ROLE_MEMBERSHIPS):
        problems.append("it is a member of another role")
    if conn.scalar(MAY_CREATE_IN_SCHEMA):
        problems.append("it may create objects in the schema public")
    if conn.scalar(MAY_CREATE_IN_DATABASE):
        problems.append("it may create schemas in the database")
    if conn.scalar(MAY_CREATE_TEMPORARY_TABLES):
        problems.append("it may create temporary tables")
    return problems


def is_allowed(grant: Grant | None, privilege: str, column: str | None = None) -> bool:
    """Whether the grant gives this privilege on the table, or on this column of it."""
    if grant is None:
        return False
    if privilege in grant.privileges:
        return True
    if column is None:
        return False
    return (
        (privilege == "SELECT" and column in grant.readable_columns)
        or (privilege == "INSERT" and column in grant.insertable_columns)
        or (privilege == "UPDATE" and column in grant.writable_columns)
    )


def differences_from_the_grants(conn: Connection, grants: Sequence[Grant]) -> list[str]:
    """Every right the account holds without being granted it, and every one it is granted but lacks."""
    by_table = {f"public.{grant.table}": grant for grant in grants}
    too_much: dict[tuple[str, str], list[str]] = defaultdict(list)
    too_little: dict[tuple[str, str], list[str]] = defaultdict(list)
    for table, column, privilege, held in conn.execute(COLUMN_PRIVILEGES).all():
        allowed = is_allowed(by_table.get(table), privilege, column)
        if held and not allowed:
            too_much[table, privilege].append(column)
        elif allowed and not held:
            too_little[table, privilege].append(column)
    for table, privilege, held in conn.execute(TABLE_PRIVILEGES).all():
        allowed = is_allowed(by_table.get(table), privilege)
        if held and not allowed:
            too_much[table, privilege].append("*")
        elif allowed and not held:
            too_little[table, privilege].append("*")
    return [
        f"it may {privilege} {table} ({', '.join(columns)})"
        for (table, privilege), columns in too_much.items()
    ] + [
        f"it may not {privilege} {table} ({', '.join(columns)})"
        for (table, privilege), columns in too_little.items()
    ]


def require_least_privilege(engine: Engine) -> None:
    """The public API's account: exactly `APP_GRANTS`, so it inserts applications and can do nothing else."""
    with engine.connect() as conn:
        problems = problems_with_the_account_itself(conn) + differences_from_the_grants(conn, APP_GRANTS)
    if problems:
        raise RuntimeError(
            "The API's database account is not the INSERT-only account it must be: "
            + "; ".join(problems)
            + "."
        )


def require_panel_privileges(engine: Engine) -> None:
    with engine.connect() as conn:
        problems = problems_with_the_account_itself(conn) + differences_from_the_grants(conn, PANEL_GRANTS)
    if problems:
        raise RuntimeError(
            "The admin panel's database account is not the account it must be: " + "; ".join(problems) + "."
        )
