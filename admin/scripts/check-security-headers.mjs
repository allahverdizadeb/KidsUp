// Verifies the security posture of the RUNNING admin origin (admin/docs/README.md rules 1, 3 and 7; SEC-B-04, SEC-B-11).
//   node admin/scripts/check-security-headers.mjs                      -> http://localhost:8081
//   node admin/scripts/check-security-headers.mjs https://admin.example
// It signs nobody in and sends nothing but requests that must be refused. Exits with code 1 if any check fails.
// Needs Node 18+ (built-in fetch); no dependencies.
import { readFileSync } from 'node:fs';

const base = (process.argv[2] ?? 'http://localhost:8081').replace(/\/$/, '');
const origin = new URL(base).origin;
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const get = (path, init) => fetch(base + path, { redirect: 'manual', ...init });

const expected = JSON.parse(readFileSync(new URL('./expected-headers.json', import.meta.url), 'utf8'));

const parsePolicy = (policy) =>
  Object.fromEntries(
    policy
      .split(';')
      .map((directive) => directive.trim())
      .filter(Boolean)
      .map((directive) => {
        const [name, ...sources] = directive.split(/\s+/);
        return [name, sources];
      }),
  );
const canonical = (policy) => JSON.stringify(Object.entries(policy).sort(([a], [b]) => a.localeCompare(b)));

// Every answer, the refusals included, carries exactly the documented headers once, never caches, and gets the policy
// of its kind: the screens' for the page, the strict one for anything that is the API's (or nginx's about the API).
const checkAnswer = (label, response, kind = 'api') => {
  const problems = [];
  for (const [name, wanted] of Object.entries(expected.headers)) {
    const actual = response.headers.get(name);
    if (actual !== wanted) problems.push(`${name}: ${actual ?? '(missing)'}`);
  }
  const actualPolicy = response.headers.get('content-security-policy') ?? '';
  if (canonical(parsePolicy(actualPolicy)) !== canonical(expected.csp[kind]))
    problems.push(`content-security-policy: ${actualPolicy || '(missing)'}`);
  if (/\d/.test(response.headers.get('server') ?? '')) problems.push('server header reveals a version');
  check(`${label}: security headers, once each, never cached`, problems.length === 0, problems.join('; '));
};

const home = await get('/');
check('the screens answer 200', home.status === 200, String(home.status));
checkAnswer('the screens', home, 'page');
const html = await home.text();
check('no inline <script> in the page', !/<script(?![^>]*\ssrc=)[^>]*>/.test(html));
check('nothing is loaded from another origin', !/(?:src|href)="(?:https?:)?\/\//.test(html));

// Nothing is public: every call of the API without a session is refused, and says nothing about the data.
for (const path of [
  '/api/admin/sessions/current',
  '/api/admin/applications/pulse',
  '/api/admin/applications/00000000-0000-4000-8000-000000000000',
  '/api/admin/courses',
  '/api/admin/dashboard',
  '/api/admin/content',
  '/api/admin/media',
  '/api/admin/audit',
]) {
  const answer = await get(path);
  check(`GET ${path} without a session is refused (401)`, answer.status === 401, String(answer.status));
  checkAnswer(`GET ${path}`, answer);
}
const json = { 'Content-Type': 'application/json', Origin: origin };
for (const [method, path] of [
  ['POST', '/api/admin/applications/search'],
  ['POST', '/api/admin/applications/export'],
  ['PATCH', '/api/admin/applications/00000000-0000-4000-8000-000000000000'],
  ['DELETE', '/api/admin/applications/00000000-0000-4000-8000-000000000000'],
  ['POST', '/api/admin/courses'],
  ['PUT', '/api/admin/content'],
  ['POST', '/api/admin/content/publications'],
]) {
  const answer = await get(path, { method, headers: json, body: method === 'DELETE' ? undefined : '{}' });
  check(`${method} ${path} without a session is refused`, [401, 403].includes(answer.status), String(answer.status));
  checkAnswer(`${method} ${path}`, answer);
}

// Signing in: a wrong attempt gets the one uniform answer, whatever was wrong.
const wrong = await get('/api/admin/sessions', {
  method: 'POST',
  headers: json,
  body: JSON.stringify({ email: 'nobody@example.test', password: 'not a password at all', code: '000000' }),
});
check('a sign-in with nothing right is refused (401)', wrong.status === 401, String(wrong.status));
check('the refusal sets no cookie', wrong.headers.get('set-cookie') === null);
checkAnswer('refused sign-in', wrong);
const wrongSignIn = await get('/api/admin/sessions', { method: 'GET' });
check('GET on the sign-in is refused by nginx (405)', wrongSignIn.status === 405, String(wrongSignIn.status));
checkAnswer('refused GET on the sign-in', wrongSignIn);

// What nginx itself refuses, before the API sees it.
const oversized = await get('/api/admin/sessions', {
  method: 'POST',
  headers: json,
  body: 'x'.repeat(70_000),
});
check('a body over 64 KiB is refused (413)', oversized.status === 413, String(oversized.status));
checkAnswer('oversized body (nginx 413)', oversized);
const other = await get('/api/health');
check('nothing outside /api/admin/ is passed on (/api/health -> 404)', other.status === 404, String(other.status));
checkAnswer('/api/health (nginx 404)', other);
const docs = await get('/api/admin/openapi.json');
check('the API schema is not exposed (/api/admin/openapi.json)', docs.status === 404, String(docs.status));
const homePost = await get('/', { method: 'POST', body: 'x' });
check('POST / is refused', [403, 405].includes(homePost.status), String(homePost.status));
checkAnswer('refused POST /', homePost, 'page');
const dotfile = await get('/.env');
check('dotfiles are refused (/.env)', dotfile.status === 403, String(dotfile.status));
checkAnswer('refused dotfile (nginx 403)', dotfile, 'page');
const longAddress = await get(`/${'a'.repeat(9000)}`);
check('an over-long request address is refused (414)', longAddress.status === 414, String(longAddress.status));
checkAnswer('over-long request address (nginx 414)', longAddress, 'page');

for (const { name, ok, detail } of results)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  -> ${detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
