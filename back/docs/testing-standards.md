# Backend testing standards

Tool: **pytest** + **pytest-cov** + `httpx` (FastAPI `TestClient`), against a **real PostgreSQL**.

## 1. The coverage gate (mandatory)

- **Project-level coverage MUST be at least 80%**, measured on `app/` with **branch coverage on**.
- It is enforced automatically: `pytest.ini` runs `--cov=app --cov-branch --cov-fail-under=80`, so the test run **fails** below 80%. Lowering the threshold, adding `# pragma: no cover` or excluding files to pass the gate is forbidden without an entry in the *Accepted risks* table of [`security-standards.md`](security-standards.md).
- 80% is a **floor, not a target.** Current coverage is 100%; do not let it erode. New or changed code SHOULD be covered ≥ 90%, and **security-relevant code (validation, authentication, authorisation, limits, headers) MUST be covered 100%, including every failure branch.**
- Coverage proves code *ran*, not that it is *correct*. A test without a meaningful assertion does not count, and reviewers reject it.

## 2. What to test where

| Level | Scope | Tools | Share |
|---|---|---|---|
| **Unit** | One function/class in isolation, pure logic, injected clock/randomness (`RateLimiter`, validators, settings) | pytest | many, milliseconds |
| **Integration (the default for this API)** | A request through router → service → **real PostgreSQL** → response, asserting both the HTTP result and the stored rows | `TestClient` + real DB | the main body |
| **Security** | One test per control in [`security-standards.md`](security-standards.md): headers, host check, CORS, limits, rate limit, docs off in production | `TestClient` | every control, no exceptions |
| **Migration** | The suite builds the schema by running all Alembic migrations (`tests/conftest.py`), so a broken migration fails every test | alembic | implicit |

Do not mock what you own. **The database is never mocked or replaced with SQLite**: the schema uses PostgreSQL arrays, timezone-aware timestamps and constraints that SQLite would silently ignore.

## 3. Structure and naming

- `tests/` mirrors `app/` by topic: `test_applications.py`, `test_rate_limiter.py`, `test_security.py`, `test_config.py`. One test module per unit or concern, never a catch-all.
- **Test names state the behaviour in plain words**: `test_rejects_unknown_host`, `test_window_slides`, `test_invalid_requests_also_count_towards_the_limit`. Not `test_1`, `test_host`, `test_works`.
- **Arrange – Act – Assert**, visibly separated; **one behaviour per test**. A test that needs "and" in its name is two tests.
- Use `pytest.mark.parametrize` for the same rule over many inputs, with readable ids; never loops that hide which case failed.
- Fixtures are nouns (`client`, `app`); shared ones live in `tests/conftest.py`; keep fixtures small and explicit. Prefer a helper (`make_settings(**overrides)`) over global mutable state.
- Test data is **obviously fake**. Never real names, real phone numbers or real children. Phone numbers use the `+994 50 123 45 67` pattern.

## 4. Isolation and determinism

- Every test starts from an **empty database** (`clean_database` fixture truncates). Tests MUST NOT depend on order, on each other, or on data from a previous run.
- Time, randomness and rate limits are **injected** (`RateLimiter(clock=FakeClock())`), never real `sleep`. A test that takes more than a second is a smell.
- No network access in tests. External services are replaced at the boundary with fakes written for the test.
- A flaky test is a **bug**: fix or delete it the same day. Never retry-until-green and never `skip` without a linked issue.

## 5. Writing a good test (and a bad one)

```python
def test_oversized_body_is_rejected(client):
    huge = {**VALID, "parent_name": "A" * 20_000}  # Arrange
    response = client.post("/api/applications", json=huge)  # Act
    assert response.status_code == 413  # Assert: the contract, not the implementation
```

Bad: asserting private attributes, mirroring the implementation line by line, snapshotting entire responses, asserting only `status_code == 200` for something that also writes rows, or catching broad exceptions to make a test pass.

For **every bug fix write the failing test first**, then the fix. For every new validation rule test: accepts the boundary value, rejects one past it, and rejects wrong types.

## 6. Running

```text
python -m pytest                      # whole suite + coverage report + 80% gate
python -m pytest tests/test_security.py -q
python -m pytest --cov-report=html    # open htmlcov/index.html to see uncovered branches
```

Local PostgreSQL: `localhost:5432` (user/password `postgres`); the suite creates and uses `kidsup_test`. Override with `KIDSUP_TEST_DATABASE_URL`. In CI use a throw-away PostgreSQL service container.

## 7. Review checklist for tests

- [ ] Does each new branch and each security control have a test that would fail if it were removed?
- [ ] Are names behaviour sentences, and is each test about one thing?
- [ ] Is the data fake, the database real, the clock injected, the test order-independent?
- [ ] Do assertions check observable behaviour (status, body, stored rows, headers)?
- [ ] Is coverage still ≥ 80% overall and 100% on security code, with no new `no cover`?
