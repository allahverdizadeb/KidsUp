import uuid
from datetime import date, datetime
from enum import StrEnum

from pydantic import JsonValue
from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    FetchedValue,
    ForeignKey,
    Identity,
    Index,
    Integer,
    SmallInteger,
    String,
    UniqueConstraint,
    Uuid,
    false,
    func,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ApplicationStatus(StrEnum):
    """Where an application stands.

    The retention job deletes by status (SEC-B-09), so an unknown one must not exist: adding a status takes a
    migration, and with it a decision on how long such applications are kept. Everything except `approved` is
    deleted after the retention period; an approved family is kept.
    """

    NEW = "new"
    CONTACTED = "contacted"
    APPROVED = "approved"
    DECLINED = "declined"


class Course(Base):
    """A group of the programme: when it starts, what it costs, how many children it takes."""

    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint("length(btrim(title)) > 0", name="ck_courses_title_not_blank"),
        CheckConstraint("capacity BETWEEN 1 AND 500", name="ck_courses_capacity_range"),
        CheckConstraint(
            "price_minor BETWEEN 0 AND 10000000 AND second_child_price_minor BETWEEN 0 AND 10000000",
            name="ck_courses_prices_range",
        ),
        CheckConstraint("age_min >= 0 AND age_max >= age_min AND age_max <= 25", name="ck_courses_age_range"),
        CheckConstraint("currency IN ('AZN')", name="ck_courses_currency_known"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(120))
    start_date: Mapped[date] = mapped_column(Date)
    schedule: Mapped[str] = mapped_column(String(120))
    location: Mapped[str] = mapped_column(String(200))
    age_min: Mapped[int] = mapped_column(SmallInteger)
    age_max: Mapped[int] = mapped_column(SmallInteger)
    # Money is whole qəpik (1 AZN = 100 qəpik) with a currency code.
    price_minor: Mapped[int] = mapped_column(Integer)
    second_child_price_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="AZN", server_default="AZN")
    # Places for children, not for applications: an application brings one or two.
    capacity: Mapped[int] = mapped_column(SmallInteger)
    registration_open: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (
        CheckConstraint(
            "(consent_given_at IS NULL) = (privacy_notice_version IS NULL)",
            name="ck_applications_consent_recorded_together",
        ),
        CheckConstraint(
            "status IN (" + ", ".join(f"'{status.value}'" for status in ApplicationStatus) + ")",
            name="ck_applications_status_known",
        ),
    )

    # The API's database account may insert and nothing else, not even read a column back: after an INSERT the
    # ORM must not fetch the values the database generated (created_at, consent_given_at) with RETURNING.
    __mapper_args__ = {"eager_defaults": False}  # noqa: RUF012 (SQLAlchemy's documented way)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    parent_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(32))
    languages: Mapped[list[str]] = mapped_column(ARRAY(String(16)))
    # Only the database's default sets it on insert: the public API's account has no right to insert a status.
    status: Mapped[str] = mapped_column(String(16), server_default=ApplicationStatus.NEW.value)
    # Set by staff when they change the status. `FetchedValue` only tells the ORM the database owns the value,
    # so an insert by the public API leaves the column out (that account has no right to insert it).
    status_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=FetchedValue()
    )
    # Which course the family applies for. A page that sends none gets the one open course (a trigger fills it
    # in, see migration 0006), so the API never has to read the courses.
    course_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("courses.id", ondelete="RESTRICT"), index=True)
    # When the parent agreed, and to which privacy notice. Both are empty only for rows older than the notice.
    consent_given_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    privacy_notice_version: Mapped[str | None] = mapped_column(String(32))

    children: Mapped[list["Child"]] = relationship(
        back_populates="application", cascade="all, delete-orphan", order_by="Child.position"
    )
    # Loaded on purpose (joinedload) where it is needed, never by a stray attribute access.
    course: Mapped[Course] = relationship(lazy="raise")


class Child(Base):
    __tablename__ = "application_children"
    __table_args__ = (
        # An application brings one or two children (the form and the API allow no more); the database says
        # so too, whoever writes the rows. A seat is taken per child, so this also bounds the seats one
        # application can take (migration 0011).
        CheckConstraint("position BETWEEN 0 AND 1", name="ck_application_children_position_range"),
        UniqueConstraint("application_id", "position", name="uq_application_children_position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(SmallInteger)
    name: Mapped[str] = mapped_column(String(120))
    birth_date: Mapped[date] = mapped_column(Date)

    application: Mapped[Application] = relationship(back_populates="children")


class ApplicationNote(Base):
    """What staff wrote about an application. It goes with the application when that is deleted."""

    __tablename__ = "application_notes"
    __table_args__ = (CheckConstraint("length(btrim(body)) > 0", name="ck_application_notes_body_not_blank"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    admin_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"))
    body: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdminRole(StrEnum):
    """The least-privilege roles of the admin panel (SEC-B-04); their rights: `app/panel/permissions.py`."""

    VIEWER = "viewer"
    COORDINATOR = "coordinator"
    ADMIN = "admin"


class AdminUser(Base):
    __tablename__ = "admin_users"
    __table_args__ = (
        CheckConstraint(
            "role IN (" + ", ".join(f"'{role.value}'" for role in AdminRole) + ")",
            name="ck_admin_users_role_known",
        ),
        CheckConstraint("email = lower(email) AND length(email) > 2", name="ck_admin_users_email_lowercase"),
        Index("uq_admin_users_email", "email", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(254))
    display_name: Mapped[str] = mapped_column(String(80))
    role: Mapped[str] = mapped_column(String(16))
    # Argon2id. The one-time-code secret is stored encrypted with a key that is not in the database.
    password_hash: Mapped[str] = mapped_column(String(255))
    totp_secret: Mapped[str] = mapped_column(String(255))
    last_totp_step: Mapped[int | None] = mapped_column(BigInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    failed_logins: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AdminSession(Base):
    """One sign-in. Only a hash of the cookie's value is stored."""

    __tablename__ = "admin_sessions"
    __table_args__ = (Index("uq_admin_sessions_token_hash", "token_hash", unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(64))
    admin_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("admin_users.id", ondelete="CASCADE"), index=True)
    csrf_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditEntry(Base):
    """Who did what, when and from which network. Append-only: the database refuses to change a row."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    admin_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    admin_email: Mapped[str | None] = mapped_column(String(254))
    action: Mapped[str] = mapped_column(String(48))
    entity_type: Mapped[str | None] = mapped_column(String(32))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    # Ids and states only, never a name, a phone number, a note or a search term.
    detail: Mapped[JsonValue] = mapped_column(JSONB)
    network: Mapped[str | None] = mapped_column(String(45))


class SiteContent(Base):
    """The draft of the landing page: one value per content key."""

    __tablename__ = "site_content"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[JsonValue] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"))


class SitePublication(Base):
    """The whole content at the moment it was published. The newest one is what the landing page shows."""

    __tablename__ = "site_publications"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    published_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"))
    content: Mapped[JsonValue] = mapped_column(JSONB)


class MediaAsset(Base):
    """An image staff uploaded; the file itself is a re-encoded copy in the content volume, named by `id`."""

    __tablename__ = "media_assets"
    __table_args__ = (Index("uq_media_assets_sha256", "sha256", unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    sha256: Mapped[str] = mapped_column(String(64))
    width: Mapped[int] = mapped_column(SmallInteger)
    height: Mapped[int] = mapped_column(SmallInteger)
    byte_size: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("admin_users.id", ondelete="SET NULL"))
