"""enforce course rules in the database

Why: three rules must hold whoever writes the rows, so they live in the database and not only in the code:

* an application is stored only for a course that is open for registration and has free seats; the public
  API's account can only INSERT and cannot read the courses, so the check runs inside a trigger with the
  owner's rights (error KU001). An application sent without a course goes to the one open course, if there
  is exactly one (a page loaded before this change still posts without one);
* a seat is taken only by an approved application, one seat per child, and an application is approved only
  while the course has enough free seats (error KU002). The course row is locked meanwhile, so two people
  approving at once cannot both take the last seats;
* a course cannot be given fewer places than the children already approved (error KU003).

The functions fix `search_path`, as every SECURITY DEFINER function must. The trigger functions cannot be
called by anyone; the two helpers run with the caller's rights, so an account that cannot read the tables
cannot read them through the helpers either.

Reversible: the triggers and functions are dropped; no row is touched.

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-20
"""

from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

FUNCTIONS = (
    """
    CREATE FUNCTION course_seats_taken(course uuid) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path = pg_catalog, public
    AS $$
        SELECT count(*)::integer
        FROM public.application_children AS child
        JOIN public.applications AS application ON application.id = child.application_id
        WHERE application.course_id = course AND application.status = 'approved'
    $$
    """,
    """
    CREATE FUNCTION course_accepts_applications(course uuid) RETURNS boolean
    LANGUAGE sql STABLE
    SET search_path = pg_catalog, public
    AS $$
        SELECT c.registration_open AND public.course_seats_taken(c.id) < c.capacity
        FROM public.courses AS c
        WHERE c.id = course
    $$
    """,
    """
    CREATE FUNCTION applications_pick_course() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
    DECLARE
        open_courses uuid[];
    BEGIN
        IF NEW.course_id IS NULL THEN
            SELECT array_agg(c.id) INTO open_courses
            FROM public.courses AS c
            WHERE public.course_accepts_applications(c.id);
            IF cardinality(open_courses) IS DISTINCT FROM 1 THEN
                RAISE EXCEPTION 'no single course is accepting applications' USING ERRCODE = 'KU001';
            END IF;
            NEW.course_id := open_courses[1];
        ELSIF NOT coalesce(public.course_accepts_applications(NEW.course_id), false) THEN
            RAISE EXCEPTION 'the course is not accepting applications' USING ERRCODE = 'KU001';
        END IF;
        RETURN NEW;
    END
    $$
    """,
    """
    CREATE FUNCTION applications_guard_seats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
    DECLARE
        places integer;
        wanted integer;
    BEGIN
        IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
            SELECT c.capacity INTO places FROM public.courses AS c WHERE c.id = NEW.course_id FOR UPDATE;
            SELECT count(*) INTO wanted FROM public.application_children AS child
            WHERE child.application_id = NEW.id;
            IF public.course_seats_taken(NEW.course_id) + wanted > places THEN
                RAISE EXCEPTION 'not enough free places in the course' USING ERRCODE = 'KU002';
            END IF;
        END IF;
        RETURN NEW;
    END
    $$
    """,
    """
    CREATE FUNCTION courses_guard_capacity() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
    BEGIN
        IF NEW.capacity < OLD.capacity AND NEW.capacity < public.course_seats_taken(NEW.id) THEN
            RAISE EXCEPTION 'the course has more approved children than the new capacity'
                USING ERRCODE = 'KU003';
        END IF;
        RETURN NEW;
    END
    $$
    """,
)
TRIGGERS = (
    "CREATE TRIGGER applications_pick_course BEFORE INSERT ON applications "
    "FOR EACH ROW EXECUTE FUNCTION applications_pick_course()",
    "CREATE TRIGGER applications_guard_seats BEFORE UPDATE OF status ON applications "
    "FOR EACH ROW EXECUTE FUNCTION applications_guard_seats()",
    "CREATE TRIGGER courses_guard_capacity BEFORE UPDATE OF capacity ON courses "
    "FOR EACH ROW EXECUTE FUNCTION courses_guard_capacity()",
)
DROPS = (
    "DROP TRIGGER courses_guard_capacity ON courses",
    "DROP TRIGGER applications_guard_seats ON applications",
    "DROP TRIGGER applications_pick_course ON applications",
    "DROP FUNCTION courses_guard_capacity()",
    "DROP FUNCTION applications_guard_seats()",
    "DROP FUNCTION applications_pick_course()",
    "DROP FUNCTION course_accepts_applications(uuid)",
    "DROP FUNCTION course_seats_taken(uuid)",
)


def upgrade() -> None:
    for statement in (*FUNCTIONS, *TRIGGERS):
        op.execute(statement)


def downgrade() -> None:
    for statement in DROPS:
        op.execute(statement)
