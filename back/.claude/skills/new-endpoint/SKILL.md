---
name: new-endpoint
description: Add a new API endpoint to the KidsUp backend following the layering, naming, security and testing standards (schema, router, service, rate limit/auth decision, tests, contract docs). Use whenever a route is added or changed in back/.
---

# Add an endpoint

Read `back/docs/api-and-database-standards.md` §1–2 and `back/docs/security-standards.md` first. **Security decisions come before code.**

## Decide (write the answers in the PR / CLAUDE.md)

1. **Who may call it?** Public endpoints are exceptional and must be listed in `back/CLAUDE.md`. Everything else needs authentication + authorisation (default deny, object-level checks: `SEC-B-03/04`). Authentication does not exist yet: if the endpoint is not public, stop and raise it with the owner.
2. **What personal data does it read or write?** Justify every field (`SEC-B-09`); never return more than needed; never log it.
3. **Abuse:** rate limit (router-level `dependencies=[Depends(enforce_rate_limit)]`) and body size are mandatory for public writes (`SEC-B-08`).

## Build (in this order)

1. **Schema** in `app/schemas/<entity>.py`: `<Entity>Create` / `<Entity>Update` for input, `<Entity>Read` / `<Entity>Created` / `<Entity>Summary` for output. Every string has `max_length` (strip whitespace), every list `max_length`, numbers have ranges, enums are `Literal`/`StrEnum` (`SEC-B-01`).
2. **Service** in `app/services/<entity>s.py`: a verb-phrase function that owns the transaction. Raises specific domain exceptions; imports no `fastapi`; uses SQLAlchemy only (never string SQL: `SEC-B-02`).
3. **Router** in `app/routers/<entity>s.py`: parses, calls the service, maps to the response schema. Set `response_model` and `status_code`. Register it in `create_app()` in `app/main.py`. Paths are `/api/<plural-noun>`; collections are paginated.
4. **Migration** if tables or columns change: `new-migration` skill.
5. **Tests** in `tests/test_<entity>s.py` against the real database: success, each validation rule (boundary, one past it, wrong type), each failure mapping, authorisation (once it exists), rate limit, and that no personal data leaks into the response. Security paths 100% covered.
6. **Document the contract** in `back/CLAUDE.md` (API section): path, method, body, limits, status codes. The frontend reads it from there.

## Finish

Run the `verify-backend` skill; run the `backend-reviewer` and `security-reviewer` agents; update the compliance table in `back/docs/security-standards.md` if a control's status changed. Tell `front/` (via `cross-stack-feature`) if the contract changed.
