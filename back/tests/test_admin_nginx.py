"""The admin panel's origin as written in admin/nginx and admin/Dockerfile (admin/docs/README.md rules).

The files are read as data; nothing here starts nginx. `docker compose up` and a look at the answers is the
live check. (Like test_compose.py, this reads files outside back/. It moves into admin/ when that project
gets its own tooling.)
"""

import json
import re
from pathlib import Path

import pytest

ADMIN = Path(__file__).resolve().parents[2] / "admin"
NGINX = ADMIN / "nginx"
FRONT_NGINX = ADMIN.parent / "front" / "nginx"

ADMIN_ONLY = {"x-robots-tag", "cache-control"}  # what this origin adds to the public site's headers
SECURITY_HEADERS = "include /etc/nginx/snippets/security-headers.conf;"
CSP_PAGE = "include /etc/nginx/snippets/csp-page.conf;"
CSP_API = "include /etc/nginx/snippets/csp-api.conf;"
PROXY_PANEL = "include /etc/nginx/snippets/proxy-panel.conf;"


def read(name: str) -> str:
    return (NGINX / name).read_text(encoding="utf-8")


def added_headers(conf: str) -> dict[str, str]:
    return {
        match[1].lower(): match[2]
        for match in re.finditer(r'^add_header (\S+) "([^"]*)" always;$', conf, re.M)
    }


def blocks(conf: str, keyword: str) -> dict[str, str]:
    """The text inside `{ ... }` of every block whose first line starts with `keyword`, by that line."""
    found: dict[str, str] = {}
    for match in re.finditer(rf"^[ \t]*({keyword}[^\n]*?)\s*\{{[ \t]*$", conf, re.M):
        depth, end = 1, match.end()
        while depth and end < len(conf):
            depth += (conf[end] == "{") - (conf[end] == "}")
            end += 1
        found[match[1]] = conf[match.end() : end - 1]
    return found


DEFAULT = read("default.conf")
LOCATIONS = blocks(DEFAULT, r"location\s")


def active_lines(conf: str) -> list[str]:
    return [line.strip() for line in conf.splitlines() if line.strip() and not line.strip().startswith("#")]


def test_every_location_sends_the_security_headers_and_exactly_one_content_security_policy():
    assert len(LOCATIONS) >= 6
    for header, body in LOCATIONS.items():
        text = body + read("proxy-panel.conf") if PROXY_PANEL in body else body
        assert SECURITY_HEADERS in text, header
        assert (CSP_PAGE in text) != (CSP_API in text), f"{header} needs exactly one policy"


def test_answers_nginx_gives_before_choosing_a_location_carry_the_headers_too():
    server_level = DEFAULT
    for body in LOCATIONS.values():
        server_level = server_level.replace(body, "")
    assert SECURITY_HEADERS in server_level
    assert CSP_PAGE in server_level


def test_the_headers_are_those_of_the_public_site_plus_never_indexed_and_never_cached():
    own = added_headers(read("security-headers.conf"))
    public = added_headers((FRONT_NGINX / "security-headers.conf").read_text(encoding="utf-8"))

    assert {name: value for name, value in own.items() if name not in ADMIN_ONLY} == public
    assert own["x-robots-tag"] == "noindex, nofollow, noarchive, nosnippet"
    assert own["cache-control"] == "no-store"


def parse_policy(policy: str) -> dict[str, list[str]]:
    directives = [directive.split() for directive in policy.split(";") if directive.strip()]
    return {name: sources for name, *sources in directives}


def test_the_live_check_expects_exactly_what_nginx_is_written_to_send():
    expected = json.loads((ADMIN / "scripts" / "expected-headers.json").read_text(encoding="utf-8"))

    assert added_headers(read("security-headers.conf")) == expected["headers"]
    page, api = (
        added_headers(read(name))["content-security-policy"] for name in ("csp-page.conf", "csp-api.conf")
    )
    assert parse_policy(page) == expected["csp"]["page"]
    assert parse_policy(api) == expected["csp"]["api"]


def test_the_policies_are_those_of_the_public_site():
    for name in ("csp-page.conf", "csp-api.conf"):
        assert (
            read(name).splitlines()[-1] == (FRONT_NGINX / name).read_text(encoding="utf-8").splitlines()[-1]
        )


def test_the_page_policy_allows_nothing_from_outside():
    policy = added_headers(read("csp-page.conf"))["content-security-policy"]
    assert not re.search(r"unsafe-|https?:|\*|data:|blob:", policy)
    assert "frame-ancestors 'none'" in policy
    assert "require-trusted-types-for 'script'" in policy


def test_only_the_panel_api_is_passed_on_and_only_under_api_admin():
    proxying = {header for header, body in LOCATIONS.items() if PROXY_PANEL in body}
    assert proxying == {
        "location = /api/admin/sessions",
        "location = /api/admin/media",
        "location /api/admin/",
    }
    assert DEFAULT.count("proxy_pass") == 0  # the one proxy_pass is in the shared snippet
    assert read("proxy-panel.conf").count("proxy_pass") == 1
    other = LOCATIONS["location /api/"]
    assert "return 404;" in other
    assert PROXY_PANEL not in other


def test_the_panel_is_looked_up_by_name_again_as_its_address_changes():
    assert re.search(r"^\s*resolver 127\.0\.0\.11 valid=\d+s ipv6=off;$", DEFAULT, re.M)
    assert "set $panel_upstream http://panel:8000;" in read("proxy-panel.conf")


def test_only_the_sign_in_is_answered_before_the_rate_limiter_and_only_for_post():
    body = LOCATIONS["location = /api/admin/sessions"]
    assert re.search(r"if \(\$request_method != POST\) \{\s*return 405;\s*\}", body)
    assert body.index("$request_method != POST") < body.index("limit_req zone=admin_signin")
    assert "limit_except" not in body  # it would switch the request to its own, empty rewrite rules


def test_every_way_in_is_rate_limited_per_address_before_python_sees_it():
    assert re.search(
        r"^limit_req_zone \$binary_remote_addr zone=admin_signin:\d+m rate=\d+r/m;$", DEFAULT, re.M
    )
    assert re.search(r"^limit_req_zone \$binary_remote_addr zone=admin_api:\d+m rate=\d+r/m;$", DEFAULT, re.M)
    for header in ("location = /api/admin/sessions", "location = /api/admin/media", "location /api/admin/"):
        assert re.search(r"limit_req zone=admin_\w+ burst=\d+ nodelay;", LOCATIONS[header]), header
        assert "limit_req_status 429;" in LOCATIONS[header], header


def test_bodies_are_small_except_for_the_one_picture_upload():
    assert re.search(r"^\s*client_max_body_size 64k;$", DEFAULT, re.M)
    sizes = {header: re.findall(r"client_max_body_size (\S+);", body) for header, body in LOCATIONS.items()}
    assert {header for header, found in sizes.items() if found} == {"location = /api/admin/media"}
    assert sizes["location = /api/admin/media"] == ["5m"]  # exactly what the API takes (5 MiB), no more


def test_one_address_may_hold_only_so_many_requests_open_and_a_picture_upload_only_two():
    # limit_req counts a request when it starts; a body sent slowly holds a connection (and temporary space).
    assert re.search(r"^limit_conn_zone \$binary_remote_addr zone=conn_per_address:\d+m;$", DEFAULT, re.M)
    assert re.search(r"^\s*limit_conn conn_per_address \d+;$", DEFAULT, re.M)
    assert "limit_conn_status 429;" in DEFAULT
    assert re.search(r"^\s*reset_timedout_connection on;$", DEFAULT, re.M)
    upload = LOCATIONS["location = /api/admin/media"]
    assert re.search(r"limit_conn conn_per_address [12];", upload)
    assert int(re.search(r"^\s*send_timeout (\d+)s;$", DEFAULT, re.M).group(1)) <= 20  # type: ignore[union-attr]


def test_the_apis_headers_are_replaced_not_repeated_and_it_cannot_steer_nginx():
    proxy = read("proxy-panel.conf")
    public_headers = set(added_headers(read("security-headers.conf"))) | {
        "content-security-policy",
        "cache-control",
    }
    for name in public_headers:
        assert f"proxy_hide_header {name};" in proxy.lower(), f"the API's {name} is not dropped"
    assert re.search(r"proxy_ignore_headers[^;]*X-Accel-Redirect[^;]*;", proxy)


def test_nothing_this_origin_answers_may_be_cached_and_no_location_says_otherwise():
    # no-store comes with the shared headers, which every location (and the server level) includes; a location
    # that added its own Cache-Control would send it twice.
    assert 'add_header Cache-Control "no-store" always;' in read("security-headers.conf")
    assert "Cache-Control" not in DEFAULT.replace("proxy_hide_header Cache-Control", "")
    assert "proxy_hide_header Cache-Control;" in read("proxy-panel.conf")  # the API's own is dropped
    assert "add_header Cache-Control" not in read("proxy-panel.conf")


def test_the_visitors_address_is_overwritten_never_appended_to():
    proxy = read("proxy-panel.conf")
    assert "proxy_set_header X-Forwarded-For $remote_addr;" in proxy
    assert "$proxy_add_x_forwarded_for" not in proxy  # it would keep what the client sent


def test_the_screens_accept_only_get_and_head():
    assert re.search(r"limit_except GET HEAD \{\s*deny all;\s*\}", LOCATIONS["location /"])


def test_dotfiles_are_never_served():
    assert "deny all;" in LOCATIONS[r"location ~ /\.(?!well-known)"]


def test_the_log_holds_nothing_but_a_shortened_address_the_time_the_path_and_the_outcome():
    format_line = re.search(r"log_format privacy ([^;]+);", DEFAULT)
    assert format_line is not None
    logged = set(re.findall(r"\$([a-z_]+)", format_line[1]))
    allowed = {"anonymised_address", "time_local", "request_method", "uri", "status", "body_bytes_sent"}
    assert (
        logged == allowed
    )  # $uri has no query string; $request_uri, $remote_addr or $http_* would carry more
    assert "access_log /var/log/nginx/access.log privacy;" in DEFAULT
    assert re.search(r"error_log /var/log/nginx/error\.log crit;", DEFAULT)


def test_no_proxy_address_and_no_allow_list_is_active_until_an_operator_sets_one():
    for name in ("real-ip.conf", "network-allow-list.conf"):
        assert active_lines(read(name)) == [], name
    assert "network-allow-list.conf;" in DEFAULT
    assert "real-ip.conf;" in DEFAULT


def test_the_image_ships_every_file_the_configuration_includes_and_runs_unprivileged():
    dockerfile = (ADMIN / "Dockerfile").read_text(encoding="utf-8")
    included = set(re.findall(r"include /etc/nginx/snippets/(\S+);", DEFAULT + read("proxy-panel.conf")))

    assert included == {
        "security-headers.conf",
        "csp-page.conf",
        "csp-api.conf",
        "proxy-panel.conf",
        "real-ip.conf",
        "network-allow-list.conf",
    }
    for name in included:
        assert f"COPY nginx/{name} /etc/nginx/snippets/{name}" in dockerfile, name
    assert re.findall(r"^USER (\S+)$", dockerfile, re.M)[-1] == "101"
    assert "FROM nginxinc/nginx-unprivileged" in dockerfile


@pytest.mark.parametrize("forbidden", ["<script", "<style", " style=", "onclick", "http://", "https://"])
def test_the_page_served_until_the_screens_exist_loads_nothing_and_runs_nothing(forbidden):
    # The policy forbids inline script and style, and any outside resource.
    assert forbidden not in (ADMIN / "public" / "index.html").read_text(encoding="utf-8").lower()
