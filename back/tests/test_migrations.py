"""Every migration can be applied, undone and applied again (api-and-database standards, section 4)."""

import uuid

from alembic.config import Config
from sqlalchemy.engine import URL

from alembic import command
from app.bootstrap import connect

INSERT_APPLICATION = (
    "INSERT INTO applications (id, parent_name, phone, languages) "
    "VALUES (%s, 'Aysel', '+994 50 123 45 67', ARRAY['Rus']::varchar[])"
)


def alembic_config(url: URL) -> Config:
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", url.render_as_string(hide_password=False).replace("%", "%%"))
    return config


def public_tables(url: URL) -> set[str]:
    with connect(url) as conn:
        return {
            name for (name,) in conn.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
        }


def test_every_migration_can_be_undone_and_applied_again(scratch_database):
    config = alembic_config(scratch_database)

    command.upgrade(config, "head")
    assert public_tables(scratch_database) == {"alembic_version", "applications", "application_children"}

    command.downgrade(config, "base")
    assert public_tables(scratch_database) == {"alembic_version"}

    command.upgrade(config, "head")
    assert public_tables(scratch_database) == {"alembic_version", "applications", "application_children"}


def test_undoing_the_latest_migrations_keeps_the_applications(scratch_database):
    config = alembic_config(scratch_database)
    command.upgrade(config, "head")
    application_id = uuid.uuid4()
    with connect(scratch_database) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))

    command.downgrade(config, "0001")  # undoes the status check and the consent record, not the rows
    with connect(scratch_database) as conn:
        assert conn.execute("SELECT id FROM applications").fetchall() == [(application_id,)]

    command.upgrade(config, "head")
    with connect(scratch_database) as conn:
        assert conn.execute("SELECT id, status FROM applications").fetchall() == [(application_id, "new")]
