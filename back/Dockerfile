FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# requirements.txt is a hash-pinned lock (see docs/coding-standards.md); pip refuses anything not in it.
COPY requirements.txt .
RUN pip install --require-hashes -r requirements.txt

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

# Never run as root: a dedicated, shell-less system user owns nothing writable.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin app
USER 10001

ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"]

# Apply migrations, then serve. Needs KIDSUP_DATABASE_URL (a postgres:// URL is fine).
# --forwarded-allow-ips: only trust X-Forwarded-For from the reverse proxy in front (set it to its address).
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --no-server-header --proxy-headers --forwarded-allow-ips ${FORWARDED_ALLOW_IPS:-127.0.0.1}"]
