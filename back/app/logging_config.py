import logging


def configure_logging() -> None:
    """One log format for the commands that run outside the API (bootstrap, operator commands)."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
