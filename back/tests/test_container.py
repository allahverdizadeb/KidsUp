import json
from pathlib import Path

DOCKERFILE = Path(__file__).resolve().parents[1] / "Dockerfile"


def read_instruction(keyword: str) -> str:
    lines = DOCKERFILE.read_text(encoding="utf-8").splitlines()
    return next(line for line in lines if line.startswith(f"{keyword} "))


def read_start_command() -> list[str]:
    command = json.loads(read_instruction("CMD").removeprefix("CMD "))
    assert isinstance(command, list)
    return [str(part) for part in command]


def test_start_command_runs_without_a_shell():
    # With `sh -c` an environment value such as FORWARDED_ALLOW_IPS would be expanded by the shell: an
    # unquoted "*" became the names of the files in the working directory and the API never came up.
    command = read_start_command()
    assert command[0] == "uvicorn"
    assert all("$" not in part for part in command)


def test_api_does_not_log_visitor_addresses_or_migrate_the_schema():
    command = read_start_command()
    assert "--no-access-log" in command  # SEC-B-10: the access log records IP addresses
    assert "alembic" not in " ".join(command)  # SEC-B-07: the API's account may not change the schema


def test_image_runs_as_a_non_root_user():
    assert read_instruction("USER") != "USER root"
    assert read_instruction("USER").split()[1] != "0"
