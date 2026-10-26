"""Every migration can be applied, undone and applied again (api-and-database standards, section 4)."""

import uuid
from datetime import date

import psycopg
import pytest
from alembic.config import Config
from sqlalchemy.engine import URL
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.bootstrap import connect

INSERT_APPLICATION = (
    "INSERT INTO applications (id, parent_name, phone, languages) "
    "VALUES (%s, 'Aysel', '+994 50 123 45 67', ARRAY['Rus']::varchar[])"
)
ALL_TABLES = {
    "alembic_version",
    "applications",
    "application_children",
    "application_notes",
    "courses",
    "admin_users",
    "admin_sessions",
    "audit_log",
    "site_content",
    "site_publications",
    "media_assets",
}


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
    assert public_tables(scratch_database) == ALL_TABLES

    command.downgrade(config, "base")
    assert public_tables(scratch_database) == {"alembic_version"}

    command.upgrade(config, "head")
    assert public_tables(scratch_database) == ALL_TABLES


def test_undoing_the_latest_migrations_keeps_the_applications(scratch_database):
    config = alembic_config(scratch_database)
    command.upgrade(config, "head")
    application_id = uuid.uuid4()
    with connect(scratch_database) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))

    command.downgrade(config, "0001")  # undoes the courses, the statuses and the consent record, not the rows
    with connect(scratch_database) as conn:
        assert conn.execute("SELECT id FROM applications").fetchall() == [(application_id,)]

    command.upgrade(config, "head")
    with connect(scratch_database) as conn:
        assert conn.execute("SELECT id, status FROM applications").fetchall() == [(application_id, "new")]
        assert conn.execute(
            "SELECT count(*) FROM applications WHERE course_id IN (SELECT id FROM courses)"
        ).fetchone() == (1,)


def test_the_old_enrolled_status_becomes_approved_and_goes_back_on_undoing(scratch_database):
    config = alembic_config(scratch_database)
    command.upgrade(config, "0003")
    enrolled, waiting = uuid.uuid4(), uuid.uuid4()
    with connect(scratch_database) as conn:
        conn.execute(INSERT_APPLICATION, (enrolled,))
        conn.execute("UPDATE applications SET status = 'enrolled' WHERE id = %s", (enrolled,))
        conn.execute(INSERT_APPLICATION, (waiting,))

    command.upgrade(config, "0004")
    with connect(scratch_database) as conn:
        assert conn.execute("SELECT id, status FROM applications ORDER BY status").fetchall() == [
            (enrolled, "approved"),
            (waiting, "new"),
        ]
        conn.execute("UPDATE applications SET status = 'declined' WHERE id = %s", (waiting,))

    command.downgrade(config, "0003")
    with connect(scratch_database) as conn:
        # Nothing is lost: "approved" is "enrolled" again, and a status that did not exist before is "new".
        assert conn.execute("SELECT id, status FROM applications ORDER BY status").fetchall() == [
            (enrolled, "enrolled"),
            (waiting, "new"),
        ]


INSERT_CHILD = (
    "INSERT INTO application_children (id, application_id, position, name, birth_date) "
    "VALUES (%s, %s, %s, 'Leyla', '2016-03-14')"
)
FUNCTIONS_WITH_THE_OWNERS_RIGHTS = {
    "course_seats_taken",
    "course_accepts_applications",
    "applications_pick_course",
    "applications_guard_seats",
    "courses_guard_capacity",
    "audit_log_refuse_changes",
}


def search_paths_of_the_functions(url: URL) -> dict[str, list[str]]:
    with connect(url) as conn:
        rows = conn.execute(
            "SELECT proname, proconfig FROM pg_proc WHERE pronamespace = 'public'::regnamespace"
        ).fetchall()
    return dict(rows)


def test_an_application_can_have_two_children_at_most(scratch_database):
    command.upgrade(alembic_config(scratch_database), "head")
    application_id = uuid.uuid4()
    with connect(scratch_database) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 0))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 1))

    with connect(scratch_database) as conn, pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 2))  # a third child
    with connect(scratch_database) as conn, pytest.raises(psycopg.errors.UniqueViolation):
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 1))  # two at one position


def test_the_limit_on_children_keeps_every_row_and_goes_away_on_undoing(scratch_database):
    config = alembic_config(scratch_database)
    command.upgrade(config, "0010")
    application_id = uuid.uuid4()
    with connect(scratch_database) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 0))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 1))

    command.upgrade(config, "head")
    command.downgrade(config, "0010")

    with connect(scratch_database) as conn:
        assert conn.execute("SELECT count(*) FROM application_children").fetchone() == (2,)
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 1))  # no limit before the migration


def test_a_database_with_children_the_limit_forbids_is_not_changed_and_the_migration_stops(scratch_database):
    config = alembic_config(scratch_database)
    command.upgrade(config, "0010")
    application_id = uuid.uuid4()
    with connect(scratch_database) as conn:
        conn.execute(INSERT_APPLICATION, (application_id,))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 0))
        conn.execute(INSERT_CHILD, (uuid.uuid4(), application_id, 0))  # two at one position

    with pytest.raises(IntegrityError):
        command.upgrade(config, "head")

    with connect(scratch_database) as conn:
        assert conn.execute("SELECT version_num FROM alembic_version").fetchone() == ("0010",)
        assert conn.execute("SELECT count(*) FROM application_children").fetchone() == (2,)
        assert conn.execute(
            "SELECT count(*) FROM pg_constraint WHERE conname LIKE '%application_children_position%'"
        ).fetchone() == (0,)  # not even the check that was added before the failure


def test_the_functions_that_run_with_the_owners_rights_name_pg_temp_last_and_go_back_on_undoing(
    scratch_database,
):
    config = alembic_config(scratch_database)
    command.upgrade(config, "head")

    paths = search_paths_of_the_functions(scratch_database)
    assert {name for name in paths if paths[name]} >= FUNCTIONS_WITH_THE_OWNERS_RIGHTS
    assert {tuple(paths[name]) for name in FUNCTIONS_WITH_THE_OWNERS_RIGHTS} == {
        ("search_path=pg_catalog, public, pg_temp",)
    }

    command.downgrade(config, "0010")
    paths = search_paths_of_the_functions(scratch_database)
    assert {tuple(paths[name]) for name in FUNCTIONS_WITH_THE_OWNERS_RIGHTS} == {
        ("search_path=pg_catalog, public",)
    }


COUNT_END_DATE_COLUMNS = (
    "SELECT count(*) FROM information_schema.columns "
    "WHERE table_name = 'courses' AND column_name = 'end_date'"
)


def test_the_end_date_of_a_course_keeps_every_course_and_goes_away_on_undoing(scratch_database):
    config = alembic_config(scratch_database)
    command.upgrade(config, "0011")
    with connect(scratch_database) as conn:
        assert conn.execute(COUNT_END_DATE_COLUMNS).fetchone() == (0,)
        courses = conn.execute("SELECT id FROM courses").fetchall()
    assert len(courses) == 1
    course_id = courses[0][0]

    command.upgrade(config, "head")
    with connect(scratch_database) as conn:
        # The course is the one it was, with no end date (the owner gives one in the panel).
        assert conn.execute("SELECT end_date FROM courses WHERE id = %s", (course_id,)).fetchone() == (None,)
        conn.execute("UPDATE courses SET end_date = '2027-03-06' WHERE id = %s", (course_id,))
    with connect(scratch_database) as conn, pytest.raises(psycopg.errors.CheckViolation):
        conn.execute("UPDATE courses SET end_date = '2026-12-04' WHERE id = %s", (course_id,))

    command.downgrade(config, "0011")
    with connect(scratch_database) as conn:
        assert conn.execute("SELECT id FROM courses").fetchall() == [(course_id,)]  # the course stays
        assert conn.execute(COUNT_END_DATE_COLUMNS).fetchone() == (0,)
        assert conn.execute(
            "SELECT count(*) FROM pg_constraint WHERE conname = 'ck_courses_end_not_before_start'"
        ).fetchone() == (0,)


def test_the_first_course_is_the_programme_the_landing_page_advertises(scratch_database):
    command.upgrade(alembic_config(scratch_database), "head")

    with connect(scratch_database) as conn:
        courses = conn.execute(
            "SELECT start_date, schedule, age_min, age_max, price_minor, second_child_price_minor, currency, "
            "capacity, registration_open FROM courses"
        ).fetchall()
    assert courses == [(date(2026, 12, 5), "şənbə, 09:30–13:00", 8, 13, 65_000, 50_000, "AZN", 20, True)]
