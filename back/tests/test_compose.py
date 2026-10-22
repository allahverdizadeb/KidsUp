"""SEC-B-07, SEC-B-10 and SEC-B-15 as they are written in docker-compose.yml.

The file is read as data; nothing here starts a container. `docker compose up` plus `npm run check:headers` in
front/ is the live check. (This file and test_container.py read files outside back/, so back/ cannot be tested
completely on its own; see docs/testing-standards.md.)
"""

import asyncio
import ipaddress
import json
import re
from pathlib import Path
from typing import Any

import pytest
import yaml
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

COMPOSE_FILE = Path(__file__).resolve().parents[2] / "docker-compose.yml"
SERVICES = ["db", "bootstrap", "back", "panel", "retention", "front", "admin"]
NO_ROUTE_OUT = ["bootstrap", "back", "panel", "retention"]
PASSWORD_VARIABLES = (
    "POSTGRES_PASSWORD",
    "POSTGRES_OWNER_PASSWORD",
    "POSTGRES_APP_PASSWORD",
    "POSTGRES_RETENTION_PASSWORD",
    "POSTGRES_PANEL_PASSWORD",
)
SECRET_VARIABLES = (*PASSWORD_VARIABLES, "PANEL_SECRET_KEY")
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
    assert float(service["cpus"]) > 0  # a flood on one container cannot starve the others (SEC-B-15)
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


def test_only_the_two_nginx_containers_publish_a_port_and_only_on_loopback_by_default(compose):
    published = {name: s["ports"] for name, s in compose["services"].items() if "ports" in s}
    assert list(published) == ["front", "admin"]
    assert published["front"][0].startswith("${FRONT_BIND:-127.0.0.1}:")
    assert published["admin"][0].startswith("${ADMIN_BIND:-127.0.0.1}:")


def test_the_database_is_reachable_only_from_the_internal_data_networks(compose):
    assert compose["services"]["db"]["networks"] == ["data", "data_panel"]
    assert compose["networks"]["data"]["internal"] is True
    assert compose["networks"]["data_panel"]["internal"] is True
    assert services_on(compose, "data") == {"db", "bootstrap", "back", "retention"}
    assert services_on(compose, "data_panel") == {"db", "panel"}


def test_the_public_api_cannot_reach_the_panel_whatever_it_is_made_to_do(compose):
    # The API is what the whole internet talks to. If it is ever taken over, the panel's own login must not be
    # reachable from it, because that skips the admin nginx (allow-list, limits, headers).
    services = compose["services"]
    internet_facing_side = {"front", "back"}
    admin_side = {"admin", "panel"}

    for public in internet_facing_side:
        for private in admin_side:
            shared = set(services[public]["networks"]) & set(services[private]["networks"])
            assert shared == set(), f"{public} and {private} share {shared}"


@pytest.mark.parametrize("name", NO_ROUTE_OUT)
def test_the_api_and_the_jobs_have_no_route_to_the_internet(compose, name):
    for network in compose["services"][name]["networks"]:
        is_internal = compose["networks"][network]["internal"]
        assert is_internal is True, f"{name} is on {network}, which has a route out"


def trusted_range(compose, service="back"):
    return compose["services"][service]["environment"]["FORWARDED_ALLOW_IPS"]


@pytest.mark.parametrize(
    ("network", "service", "nginx"),
    [("app", "back", "front"), ("admin_app", "panel", "admin")],
)
def test_the_api_trusts_forwarded_addresses_only_from_the_private_range_shared_with_its_nginx(
    compose, network, service, nginx
):
    private_network = compose["networks"][network]
    subnet = private_network["ipam"]["config"][0]["subnet"]

    assert private_network["internal"] is True
    assert "*" not in trusted_range(compose, service)
    assert (
        trusted_range(compose, service) == subnet
    )  # one expression, so the trusted range and the network cannot drift apart
    assert services_on(compose, network) == {nginx, service}  # nothing else shares the trusted range


def default_of(expression: str) -> str:
    """The default of a "${NAME:-default}" expression: what compose uses when the variable is unset."""
    match = re.fullmatch(r"\$\{\w+:-([^}]+)\}", expression)
    assert match is not None, expression
    return match.group(1)


def test_the_two_private_ranges_do_not_overlap(compose):
    subnets = [
        ipaddress.ip_network(default_of(compose["networks"][name]["ipam"]["config"][0]["subnet"]))
        for name in ("app", "admin_app")
    ]
    assert not subnets[0].overlaps(subnets[1])


def test_the_admin_panel_shares_no_network_with_the_public_site(compose):
    services = compose["services"]
    assert services["front"]["networks"] == ["edge", "app"]
    assert services["admin"]["networks"] == ["admin_edge", "admin_app"]
    assert services["panel"]["networks"] == ["data_panel", "admin_app"]
    assert services_on(compose, "edge") == {"front"}
    assert services_on(compose, "admin_edge") == {"admin"}
    assert services_on(compose, "admin_app") == {"admin", "panel"}
    assert compose["networks"]["admin_app"]["internal"] is True


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


@pytest.mark.parametrize(("service", "nginx_address"), [("back", "172.29.250.2"), ("panel", "172.29.250.18")])
def test_uvicorn_believes_the_forwarded_address_from_nginx_and_from_nobody_else(
    compose, service, nginx_address
):
    # The compose value is "${APP_SUBNET:-172.29.250.0/28}": uvicorn gets the default if it is unset.
    trusted = default_of(trusted_range(compose, service))
    stranger = "203.0.113.50"

    # Through nginx: the visitor's address, taken from what nginx wrote (the right-most untrusted entry).
    assert forwarded_client(trusted, nginx_address, "198.51.100.7") == "198.51.100.7"
    # A client that reaches the API directly cannot choose its own address (and so its rate-limit bucket).
    assert forwarded_client(trusted, stranger, "198.51.100.7") == stranger


@pytest.mark.parametrize(
    ("service", "account", "own_password"),
    [
        ("back", "kidsup_app", "POSTGRES_APP_PASSWORD"),
        ("retention", "kidsup_retention", "POSTGRES_RETENTION_PASSWORD"),
        ("panel", "kidsup_panel", "POSTGRES_PANEL_PASSWORD"),
    ],
)
def test_the_api_the_panel_and_the_retention_job_each_get_only_their_own_database_account(
    compose, service, account, own_password
):
    text = environment_text(compose["services"][service])

    assert f"{account}:" in text
    assert f"${{{own_password}" in text
    for password in PASSWORD_VARIABLES:
        if password != own_password:
            assert password not in text  # the superuser's, the owner's and the other accounts'


def test_only_the_bootstrap_job_gets_the_privileged_accounts(compose):
    text = environment_text(compose["services"]["bootstrap"])
    for password in PASSWORD_VARIABLES:
        assert f"${{{password}" in text
    for variable in (
        "KIDSUP_ADMIN_DATABASE_URL",
        "KIDSUP_MIGRATION_DATABASE_URL",
        "KIDSUP_RETENTION_DATABASE_URL",
        "KIDSUP_PANEL_DATABASE_URL",
    ):
        holders = [name for name, s in compose["services"].items() if variable in s.get("environment", {})]
        assert holders == ["bootstrap"], variable


def test_only_the_panel_gets_the_key_that_encrypts_the_staff_second_factor_secrets(compose):
    holders = [name for name, s in compose["services"].items() if "PANEL_SECRET_KEY" in environment_text(s)]
    assert holders == ["panel"]


def test_the_public_nginx_and_the_admin_nginx_get_no_secret_at_all(compose):
    for name in ("front", "admin"):
        assert environment_text(compose["services"][name]) == ""


def test_empty_passwords_and_keys_are_refused_not_defaulted(compose):
    for service in compose["services"].values():
        for value in service.get("environment", {}).values():
            for name in SECRET_VARIABLES:
                if f"${{{name}" in str(value):
                    assert f"${{{name}:?" in str(value), f"{name} may default to empty in {value[:30]}..."


def test_services_start_in_order_and_the_api_waits_for_the_database_setup(compose):
    services = compose["services"]
    assert services["bootstrap"]["depends_on"]["db"]["condition"] == "service_healthy"
    for name in ("back", "panel", "retention"):
        assert services[name]["depends_on"]["bootstrap"]["condition"] == "service_completed_successfully"
    assert services["front"]["depends_on"]["back"]["condition"] == "service_healthy"
    assert services["admin"]["depends_on"]["panel"]["condition"] == "service_healthy"


def test_the_public_site_does_not_wait_for_the_panel_to_be_healthy(compose):
    # A panel that is down (a wrong key, a failed deploy) must not take the landing page down with it. It is
    # only started first, so that a new `content` volume takes its owner from the panel's image.
    assert compose["services"]["front"]["depends_on"]["panel"]["condition"] == "service_started"


@pytest.mark.parametrize("name", ["back", "panel", "retention"])
def test_the_api_the_panel_and_the_retention_job_run_in_production_mode(compose, name):
    assert compose["services"][name]["environment"]["KIDSUP_ENVIRONMENT"] == "production"


@pytest.mark.parametrize("name", ["back", "panel"])
def test_the_apis_have_no_wildcards(compose, name):
    environment = compose["services"][name]["environment"]
    assert "*" not in environment["KIDSUP_ALLOWED_HOSTS"]
    assert environment["KIDSUP_CORS_ORIGINS"] == "[]"


def test_the_panel_accepts_state_changing_requests_only_from_the_admin_origin(compose):
    origins = compose["services"]["panel"]["environment"]["KIDSUP_PANEL_ALLOWED_ORIGINS"]
    assert "*" not in origins
    assert default_of(origins) == '["http://127.0.0.1:8081","http://localhost:8081"]'


def test_the_panel_runs_without_a_shell_and_without_an_access_log(compose):
    command = compose["services"]["panel"]["command"]
    assert command[:3] == ["uvicorn", "app.panel.main:create_panel_app", "--factory"]
    assert "--no-access-log" in command  # SEC-B-10: it would record staff addresses
    assert "--workers" not in command  # the sign-in limiter and the file refresh live in the one process
    assert all("$" not in part for part in command)


def test_the_public_files_volume_is_written_by_the_panel_and_only_read_by_the_public_site(compose):
    mounts = {
        name: [volume for volume in service.get("volumes", []) if volume.startswith("content:")]
        for name, service in compose["services"].items()
    }
    assert mounts["panel"] == ["content:/srv/content"]
    assert mounts["front"] == ["content:/usr/share/nginx/content:ro"]
    assert {name for name, found in mounts.items() if found} == {"panel", "front"}


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


def test_the_panel_keeps_the_image_health_check_and_accepts_the_names_it_is_asked_by(compose):
    panel = compose["services"]["panel"]
    assert (
        "healthcheck" not in panel
    )  # the image's check asks /health on 127.0.0.1:8000, which the panel serves
    hosts = json.loads(panel["environment"]["KIDSUP_ALLOWED_HOSTS"])
    assert {"127.0.0.1", "panel"} <= set(hosts)  # the health check, and the admin nginx's upstream name
