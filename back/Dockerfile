FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Whoever starts this image gets the strict mode (no /docs, HSTS, no wildcards, the INSERT-only account check)
# unless they say otherwise; development runs natively, not from the image.
ENV KIDSUP_ENVIRONMENT=production

WORKDIR /srv

# requirements.txt is a hash-pinned lock (see docs/coding-standards.md); pip refuses anything not in it.
COPY requirements.txt .
RUN pip install --require-hashes -r requirements.txt \
    # The running API never installs anything: drop the installer and its vendored libraries (less to patch and to attack).
    && pip uninstall -y pip setuptools wheel

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

# Never run as root: a dedicated, shell-less system user.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app \
    # The only place that user may write (and only in the admin panel's container, which mounts a volume here): the files
    # the public site serves. Docker gives a new volume the owner of this directory, so the panel can write to it.
    && mkdir /srv/content \
    && chown 10001:10001 /srv/content
USER 10001

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"]

# The API does not migrate: its database account may not change the schema (SEC-B-07). The one-off `bootstrap`
# service runs `python -m app.bootstrap` first (docker-compose.yml). Needs KIDSUP_DATABASE_URL.
#
# Exec form, no shell, so nothing in an environment value is expanded or globbed. uvicorn reads
# FORWARDED_ALLOW_IPS itself (default: loopback only): the address range of the reverse proxy, nothing wider.
# --no-access-log: uvicorn's access log would record visitors' IP addresses (SEC-B-10).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-server-header", "--no-access-log", "--proxy-headers"]
