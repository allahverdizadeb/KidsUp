import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import ARRAY, CheckConstraint, Date, DateTime, ForeignKey, SmallInteger, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class ApplicationStatus(StrEnum):
    """Where an application stands.

    The retention job deletes by status (SEC-B-09), so an unknown one must not exist: adding a status takes a
    migration, and with it a decision on how long such applications are kept.
    """

    NEW = "new"
    ENROLLED = "enrolled"


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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    parent_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(32))
    languages: Mapped[list[str]] = mapped_column(ARRAY(String(16)))
    status: Mapped[str] = mapped_column(
        String(16), default=ApplicationStatus.NEW.value, server_default=ApplicationStatus.NEW.value
    )
    # When the parent agreed, and to which privacy notice. Both are empty only for rows older than the notice.
    consent_given_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    privacy_notice_version: Mapped[str | None] = mapped_column(String(32))

    children: Mapped[list["Child"]] = relationship(
        back_populates="application", cascade="all, delete-orphan", order_by="Child.position"
    )


class Child(Base):
    __tablename__ = "application_children"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(SmallInteger)
    name: Mapped[str] = mapped_column(String(120))
    birth_date: Mapped[date] = mapped_column(Date)

    application: Mapped[Application] = relationship(back_populates="children")
