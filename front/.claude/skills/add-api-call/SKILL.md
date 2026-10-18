---
name: add-api-call
description: Add a call from the KidsUp frontend to the backend API in src/api following the contract, timeout, validation, error and security rules, with tests. Use whenever the UI needs to send data to or read data from the backend.
---

# Add an API call

The contract is owned by `back/` (see the API section of `back/CLAUDE.md`); **never invent fields or status codes.** If the endpoint does not exist yet, build it first with `back/.claude/skills/new-endpoint`.

1. **Create/extend** `src/api/<resource>.ts` (camelCase module, named exports). It is the **only** code that calls `fetch`. Components import its functions.
2. **Types next to the call:** an exported payload type mirroring the backend input schema, and a result type. Use the backend's field names exactly (`snake_case` on the wire).
3. **Request rules** (`SEC-F-08`):
   - Relative URL via `API_URL` (`import.meta.env.VITE_API_URL ?? ''`), same origin by default.
   - `method`, `headers: { 'Content-Type': 'application/json' }`, `body: JSON.stringify(<explicit object>)` (never a whole state object).
   - **A timeout**: `signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)`.
   - No tokens or personal data in the URL or query string. Authentication (when it exists) uses `HttpOnly` cookies or an in-memory token, never `localStorage`.
4. **Responses are untrusted:** check `response.ok`, throw a plain `Error` for failures (no server text), and validate the shape of the JSON before returning it (`unknown` → checked type); never put it into HTML.
5. **The caller** decides what the user sees: a helpful Azerbaijani message and a fallback (like the WhatsApp message in `Apply`), never raw errors, status codes or stack traces (`SEC-F-14`).
6. **Mirror validation limits** in the form (`maxLength`, formats) so honest users never hit a server rejection; the server remains authoritative.
7. **Tests** in `src/api/<resource>.test.ts`: success (exact URL, method, headers, body), each failure status (`it.each([422, 429, 500])`), network error/timeout. In component tests mock the module (`vi.mock('../api/<resource>')`).
8. If an endpoint is public and writes data, confirm the backend has rate limiting and bounded bodies (`SEC-B-08`); if the `connect-src` CSP must change (different origin), that is a security change needing an entry in `front/docs/security-standards.md` §5.

Finish with `verify-frontend` and, because it moves personal data, the `security-reviewer` agent.
