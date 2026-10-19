"""SEC-B-07, SEC-B-10 and SEC-B-15 as they are written in docker-compose.yml.

The file is read as data; nothing here starts a container. `docker compose up` plus `npm run check:headers` in
front/ is the live check. (This file and test_container.py read files outside back/, so back/ cannot be tested
completely on its own; see docs/testing-standards.md.)
"""

import asyncio
import re
from pathlib import Path
from typing import Any

import pytest
import yaml
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

COMPOSE_FILE = Path(__file__).resolve().parents[2] / "docker-compose.yml"
SERVICES = ["db", "bootstrap", "back", "retention", "front"]
NO_ROUTE_OUT = ["bootstrap", "back", "retention"]
PASSWORD_VARIABLES = (
    "POSTGRES_PASSWORD",
    "POSTGRES_OWNER_PASSWORD",
    "POSTGRES_APP_PASSWORD",
    "POSTGRES_RETENTION_PASSWORD",
)
# Ways to hand a container more than the hardening block gives it, or to read the secrets of another service.
FORBIDDEN_KEYS = ("privileged", "cap_add", "devices", "env_file", "network_mode", "pid", "ipc", "userns_mode")


@pytest.fixture(scope="module")
def compose():
    return yaml.safe_load(COMPOSE_FILE.read_text(encoding="utf-8"))


def services_on(compose, network):
    return {name for name, service in compose["services"].items() if network in service["networks"]}


def environment_text(service):
    return " ".join(str(value) for value in service.get("environment", {}).values())


def test_the_hardening_tests_cover_every_service_in_the_file(compose):
    assert set(compose["services"]) == set(SERVICES)  # a new service must be added to the lists above


@pytest.mark.parametrize("name", SERVICES)
def test_every_container_is_locked_down(compose, name):
    service = compose["services"][name]
    assert service["read_only"] is True
    assert service["cap_drop"] == ["ALL"]
    assert "no-new-privileges:true" in service["security_opt"]
    assert not service.get("privileged")
    assert service["pids_limit"] > 0
    assert service["mem_limit"]
    assert service["logging"]["options"]["max-size"]  # log files are size-capped


@pytest.mark.parametrize("name", SERVICES)
def test_no_container_is_given_more_than_the_hardening_block_allows(compose, name):
    service = compose["services"][name]
    assert [key for key in FORBIDDEN_KEYS if key in service] == []
    assert not any("unconfined" in option for option in service["security_opt"])  # seccomp, apparmor


@pytest.mark.parametrize("name", SERVICES)
def test_no_container_mounts_the_host_or_the_docker_socket(compose, name):
    for volume in compose["services"][name].get("volumes", []):
        source = volume.split(":")[0]
        assert source in compose["volumes"], f"{name} mounts {source}, which is not a named volume"
        assert "docker.sock" not in volume


def test_postgres_runs_as_the_postgres_user_not_root(compose):
    assert compose["services"]["db"]["user"] == "70:70"


@pytest.mark.parametrize(
    "setting",
    [
        "log_error_verbosity=terse",  # no DETAIL line with the whole failing row
        "log_min_error_statement=panic",  # no text of a failing statement, whatever its literals
        "log_statement=none",
        "log_min_duration_statement=-1",  # no slow-query log, which prints statements
        "log_parameter_max_length=0",  # and if one is ever logged, without its bound values
        "log_parameter_max_length_on_error=0",
    ],
)
def test_the_database_log_never_holds_a_failing_row_or_a_statement_with_its_values(compose, setting):
    assert setting in compose["services"]["db"]["command"]


def test_only_the_front_publishes_a_port_and_only_on_loopback_by_default(compose):
    published = {name: s["ports"] for name, s in compose["services"].items() if "ports" in s}
    assert list(published) == ["front"]
    assert published["front"][0].startswith("${FRONT_BIND:-127.0.0.1}:")


def test_the_database_is_reachable_only_from_the_internal_data_network(compose):
    assert compose["services"]["db"]["networks"] == ["data"]
    assert compose["networks"]["data"]["internal"] is True
    assert services_on(compose, "data") == {"db", "bootstrap", "back", "retention"}


@pytest.mark.parametrize("name", NO_ROUTE_OUT)
def test_the_api_and_the_jobs_have_no_route_to_the_internet(compose, name):
    for network in compose["services"][name]["networks"]:
        is_internal = compose["networks"][network]["internal"]
        assert is_internal is True, f"{name} is on {network}, which has a route out"


def trusted_range(compose):
    return compose["services"]["back"]["environment"]["FORWARDED_ALLOW_IPS"]


def test_the_api_trusts_forwarded_addresses_only_from_the_private_range_shared_with_nginx(compose):
    app_network = compose["networks"]["app"]
    subnet = app_network["ipam"]["config"][0]["subnet"]

    assert app_network["internal"] is True
    assert "*" not in trusted_range(compose)
    assert (
        trusted_range(compose) == subnet
    )  # one expression, so the trusted range and the network cannot drift apart
    assert services_on(compose, "app") == {"front", "back"}  # nothing else shares the trusted range


def forwarded_client(trusted: str, peer: str, forwarded_for: str) -> str:
    """The client address uvicorn's proxy-headers middleware would hand to the API for such a request."""
    seen: dict[str, str] = {}

    async def application(scope, receive, send):
        seen["client"] = scope["client"][0]

    async def receive():
        return {"type": "http.request"}

    async def send(message):
        return None

    scope: Any = {
        "type": "http",
        "client": (peer, 5000),
        "headers": [(b"x-forwarded-for", forwarded_for.encode())],
    }
    asyncio.run(ProxyHeadersMiddleware(application, trusted_hosts=trusted)(scope, receive, send))
    return seen["client"]


def test_uvicorn_believes_the_forwarded_address_from_nginx_and_from_nobody_else(compose):
    # The compose value is "${APP_SUBNET:-172.29.250.0/28}": uvicorn gets the default if it is unset.
    default = re.fullmatch(r"\$\{APP_SUBNET:-([^}]+)\}", trusted_range(compose))
    assert default is not None
    nginx_address, stranger = "172.29.250.2", "203.0.113.50"

    # Through nginx: the visitor's address, taken from what nginx wrote (the right-most untrusted entry).
    assert forwarded_client(default.group(1), nginx_address, "198.51.100.7") == "198.51.100.7"
    # A client that reaches the API directly cannot choose its own address (and so its rate-limit bucket).
    assert forwarded_client(default.group(1), stranger, "198.51.100.7") == stranger


def test_the_api_and_the_retention_job_each_get_only_their_own_database_account(compose):
    api = environment_text(compose["services"]["back"])
    retention = environment_text(compose["services"]["retention"])

    assert "kidsup_app:" in api
    assert "kidsup_retention:" in retention
    for password in PASSWORD_VARIABLES:
        if password != "POSTGRES_APP_PASSWORD":
            assert password not in api  # the superuser's, the owner's and the retention account's
        if password != "POSTGRES_RETENTION_PASSWORD":
            assert password not in retention


def test_only_the_bootstrap_job_gets_the_privileged_accounts(compose):
    text = environment_text(compose["services"]["bootstrap"])
    for password in PASSWORD_VARIABLES:
        assert f"${{{password}" in text
    for variable in (
        "KIDSUP_ADMIN_DATABASE_URL",
        "KIDSUP_MIGRATION_DATABASE_URL",
        "KIDSUP_RETENTION_DATABASE_URL",
    ):
        holders = [name for name, s in compose["services"].items() if variable in s.get("environment", {})]
        assert holders == ["bootstrap"], variable


def test_empty_passwords_are_refused_not_defaulted(compose):
    for service in compose["services"].values():
        for value in service.get("environment", {}).values():
            for name in PASSWORD_VARIABLES:
                if f"${{{name}" in str(value):
                    assert f"${{{name}:?" in str(value), f"{name} may default to empty in {value[:30]}..."


def test_services_start_in_order_and_the_api_waits_for_the_database_setup(compose):
    services = compose["services"]
    assert services["bootstrap"]["depends_on"]["db"]["condition"] == "service_healthy"
    assert services["back"]["depends_on"]["bootstrap"]["condition"] == "service_completed_successfully"
    assert services["retention"]["depends_on"]["bootstrap"]["condition"] == "service_completed_successfully"
    assert services["front"]["depends_on"]["back"]["condition"] == "service_healthy"


@pytest.mark.parametrize("name", ["back", "retention"])
def test_the_api_and_the_retention_job_run_in_production_mode(compose, name):
    assert compose["services"][name]["environment"]["KIDSUP_ENVIRONMENT"] == "production"


def test_the_api_has_no_wildcards(compose):
    environment = compose["services"]["back"]["environment"]
    assert "*" not in environment["KIDSUP_ALLOWED_HOSTS"]
    assert environment["KIDSUP_CORS_ORIGINS"] == "[]"


def test_the_retention_command_has_no_shell_expansion(compose):
    command = " ".join(compose["services"]["retention"]["command"])
    assert "purge-expired" in command
    assert "$" not in command


def test_a_failing_retention_run_ends_the_container_instead_of_being_ignored(compose):
    command = " ".join(compose["services"]["retention"]["command"])
    assert "purge-expired || exit 1" in command
    assert compose["services"]["retention"]["restart"] == "unless-stopped"


@pytest.mark.parametrize("name", ["bootstrap", "retention"])
def test_jobs_do_not_inherit_the_image_health_check_that_asks_the_api(compose, name):
    # Those containers do not run the API, so the inherited check would mark them unhealthy for ever.
    assert compose["services"][name]["healthcheck"] == {"disable": True}
