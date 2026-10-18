from logging.config import fileConfig

from sqlalchemy import create_engine

from alembic import context
from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.config import settings
from app.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def migration_url() -> str:
    """Who migrates: an explicit URL (the bootstrap job), else the schema owner, else the API's account."""
    return (
        config.get_main_option("sqlalchemy.url") or settings.migration_database_url or settings.database_url
    )


def run_migrations_offline() -> None:
    context.configure(url=migration_url(), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(migration_url())
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
