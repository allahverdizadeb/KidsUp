"""create courses

Why: the programme runs in groups, each with a start date, a price, a number of places and a switch that opens
or closes registration. Staff manage them in the admin panel and the landing page shows the open ones.
An application now belongs to a course, so seats can be counted per course.

The first course is the programme that the landing page already advertises (6 weeks from 5 December 2026,
650 AZN for one child and 500 AZN for the second, up to 20 children, Saturdays 09:30 to 13:00, ages 8 to 13),
open for registration. Every application that exists is attached to it; no row is lost or changed otherwise.

Prices are whole qəpik (1 AZN = 100 qəpik), as the API standards ask for money.

Reversible: the link and the table are dropped, the applications stay (without a course).

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-20
"""

from datetime import date

import sqlalchemy as sa

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    courses = op.create_table(
        "courses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("schedule", sa.String(120), nullable=False),
        sa.Column("location", sa.String(200), nullable=False),
        sa.Column("age_min", sa.SmallInteger(), nullable=False),
        sa.Column("age_max", sa.SmallInteger(), nullable=False),
        sa.Column("price_minor", sa.Integer(), nullable=False),
        sa.Column("second_child_price_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="AZN", nullable=False),
        sa.Column("capacity", sa.SmallInteger(), nullable=False),
        sa.Column("registration_open", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(btrim(title)) > 0", name="ck_courses_title_not_blank"),
        sa.CheckConstraint("capacity BETWEEN 1 AND 500", name="ck_courses_capacity_range"),
        sa.CheckConstraint(
            "price_minor BETWEEN 0 AND 10000000 AND second_child_price_minor BETWEEN 0 AND 10000000",
            name="ck_courses_prices_range",
        ),
        sa.CheckConstraint(
            "age_min >= 0 AND age_max >= age_min AND age_max <= 25", name="ck_courses_age_range"
        ),
        sa.CheckConstraint("currency IN ('AZN')", name="ck_courses_currency_known"),
    )
    op.execute(
        courses.insert().values(
            id=sa.func.gen_random_uuid(),
            title="6 həftəlik KidsUp proqramı (dekabr 2026)",
            start_date=date(2026, 12, 5),
            schedule="şənbə, 09:30–13:00",
            location="Bakı, dəqiq ünvan qeydiyyatdan əvvəl bildiriləcək",
            age_min=8,
            age_max=13,
            price_minor=65_000,
            second_child_price_minor=50_000,
            capacity=20,
            registration_open=True,
        )
    )

    op.add_column("applications", sa.Column("course_id", sa.Uuid(), nullable=True))
    op.execute("UPDATE applications SET course_id = (SELECT id FROM courses ORDER BY created_at LIMIT 1)")
    op.alter_column("applications", "course_id", nullable=False)
    op.create_foreign_key(
        "fk_applications_course_id", "applications", "courses", ["course_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index("ix_applications_course_id", "applications", ["course_id"])
    op.create_index("ix_applications_created_at", "applications", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_applications_created_at", table_name="applications")
    op.drop_index("ix_applications_course_id", table_name="applications")
    op.drop_constraint("fk_applications_course_id", "applications", type_="foreignkey")
    op.drop_column("applications", "course_id")
    op.drop_table("courses")
