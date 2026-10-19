# The official image, minus one binary. `gosu` is only called when the container starts as root; ours never does
# (it starts as the postgres user, here and in docker-compose.yml: user "70:70"), so it is never run, yet it carries open
# advisories of the Go standard library it was built with. Everything else is the stock image, data directory included.
FROM postgres:17-alpine
RUN rm -f /usr/local/bin/gosu
USER postgres
