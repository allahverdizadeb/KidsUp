import uuid
from datetime import date, datetime

from sqlalchemy import ARRAY, Date, DateTime, ForeignKey, SmallInteger, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    parent_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(32))
    languages: Mapped[list[str]] = mapped_column(ARRAY(String(16)))
    status: Mapped[str] = mapped_column(String(16), default="new", server_default="new")

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
