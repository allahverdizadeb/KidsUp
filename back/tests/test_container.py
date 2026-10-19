import json
from pathlib import Path

import pytest

DOCKERFILES = {"back": Path(__file__).resolve().parents[1] / "Dockerfile"}
DOCKERFILES["db"] = DOCKERFILES["back"].parents[1] / "db" / "Dockerfile"
ROOT_USERS = {"root", "0"}


def read_instructions(keyword: str, dockerfile: str = "back") -> list[str]:
    lines = DOCKERFILES[dockerfile].read_text(encoding="utf-8").splitlines()
    return [line for line in lines if line.startswith(f"{keyword} ")]


def read_start_command() -> list[str]:
    command = json.loads(read_instructions("CMD")[-1].removeprefix("CMD "))
    assert isinstance(command, list)
    return [str(part) for part in command]


def test_start_command_runs_without_a_shell():
    # With `sh -c` an environment value such as FORWARDED_ALLOW_IPS would be expanded by the shell: an
    # unquoted "*" became the names of the files in the working directory and the API never came up.
    command = read_start_command()
    assert command[0] == "uvicorn"
    assert all("$" not in part for part in command)


def test_api_does_not_log_visitor_addresses():
    assert "--no-access-log" in read_start_command()  # SEC-B-10: uvicorn's access log records IP addresses


def test_api_does_not_migrate_the_schema():
    assert "alembic" not in " ".join(
        read_start_command()
    )  # SEC-B-07: the API's account may not change the schema


@pytest.mark.parametrize("dockerfile", ["back", "db"])
def test_image_runs_as_a_non_root_user(dockerfile):
    # The last USER decides: an earlier non-root one followed by a USER root would still end as root.
    user = read_instructions("USER", dockerfile)[-1].split()[1]
    assert user.split(":")[0] not in ROOT_USERS  # "root", "0", and also "root:root" or "0:0"


def test_database_image_does_not_ship_the_unused_gosu_binary():
    # gosu runs only when the container starts as root; ours never does, so it is dead weight.
    assert any("rm -f /usr/local/bin/gosu" in line for line in read_instructions("RUN", "db"))
