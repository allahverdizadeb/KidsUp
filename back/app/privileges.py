"""Start-up self-check: the API must be running as the limited account (SEC-B-07, SEC-B-14).

The settings can only look at the account's *name*. This asks the database what the account really is, so a
superuser (or an owner, or an account that can read anything back) is caught whatever it is called.
"""

from sqlalchemy import Engine, text

ATTRIBUTES_OF_CURRENT_ROLE = text(
    "SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolreplication "
    "FROM pg_roles WHERE rolname = current_user"
)
HAS_TABLE_PRIVILEGE = text("SELECT has_table_privilege(current_user, :table, :privilege)")
HAS_ANY_COLUMN_PRIVILEGE = text("SELECT has_any_column_privilege(current_user, :table, :privilege)")
# The API inserts applications and nothing else. It may not read even one column back (not even the creation
# time), nor change one; "any column" covers a privilege on the whole table as well as on a single column.
FORBIDDEN_COLUMN_PRIVILEGES = ("SELECT", "UPDATE", "REFERENCES")
FORBIDDEN_TABLE_PRIVILEGES = ("DELETE", "TRUNCATE", "TRIGGER")
GUARDED_TABLE = "public.applications"


def require_least_privilege(engine: Engine) -> None:
    with engine.connect() as conn:
        attributes = conn.execute(ATTRIBUTES_OF_CURRENT_ROLE).mappings().one()
        held_attributes = [name for name, held in attributes.items() if held]
        if held_attributes:
            raise RuntimeError(
                f"The API's database account has administrative attributes ({', '.join(held_attributes)})."
            )
        held_privileges = [
            privilege
            for query, privileges in (
                (HAS_ANY_COLUMN_PRIVILEGE, FORBIDDEN_COLUMN_PRIVILEGES),
                (HAS_TABLE_PRIVILEGE, FORBIDDEN_TABLE_PRIVILEGES),
            )
            for privilege in privileges
            if conn.scalar(query, {"table": GUARDED_TABLE, "privilege": privilege})
        ]
        if held_privileges:
            raise RuntimeError(
                f"The API's database account may {', '.join(held_privileges)} on {GUARDED_TABLE}; "
                "it is meant to insert applications and nothing else."
            )
