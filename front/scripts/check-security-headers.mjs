// Verifies the security posture of a RUNNING stack (see docs/security-standards.md, SEC-F-02, SEC-F-11, SEC-F-17).
//   npm run check:headers                      -> http://localhost:8080
//   npm run check:headers -- https://kidsup.az
// Exits with code 1 if any check fails. Needs Node 18+ (built-in fetch); no dependencies.
import { readFileSync } from 'node:fs';
import net from 'node:net';
import tls from 'node:tls';

const base = (process.argv[2] ?? 'http://localhost:8080').replace(/\/$/, '');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const get = (path, init) => fetch(base + path, init);

// The documented headers and policies, exactly. Anything else (an extra directive, an extra source) fails.
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

/** A raw HTTP request, for the malformed ones fetch() refuses to send. Answers like a fetch Response (status, headers). */
const rawRequest = (text) =>
  new Promise((resolve, reject) => {
    const url = new URL(base);
    const secure = url.protocol === 'https:';
    const port = Number(url.port || (secure ? 443 : 80));
    const socket = secure
      ? tls.connect({ host: url.hostname, port, servername: url.hostname })
      : net.connect(port, url.hostname);
    let data = '';
    socket.setEncoding('latin1');
    socket.setTimeout(5000, () => socket.destroy(new Error('no answer to the raw request')));
    socket.on('data', (chunk) => (data += chunk));
    socket.on('error', reject);
    socket.on(secure ? 'secureConnect' : 'connect', () => socket.write(text));
    socket.on('close', () => {
      const [head] = data.split('\r\n\r\n');
      const [statusLine, ...lines] = head.split('\r\n');
      const headers = new Map();
      for (const line of lines) {
        const at = line.indexOf(':');
        const name = line.slice(0, at).toLowerCase();
        const value = line.slice(at + 1).trim();
        headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value);
      }
      resolve({
        status: Number(statusLine.split(' ')[1]),
        headers: { get: (name) => headers.get(name) ?? null },
      });
    });
  });

const home = await get('/');
const header = (name) => home.headers.get(name) ?? '';
const policy = parsePolicy(header('content-security-policy'));

check('home page answers 200', home.status === 200, String(home.status));
for (const [directive, sources] of Object.entries(expected.csp.page)) {
  check(
    `CSP ${directive} is exactly: ${sources.join(' ')}`,
    JSON.stringify(policy[directive]) === JSON.stringify(sources),
    (policy[directive] ?? ['(missing)']).join(' '),
  );
}
check(
  'CSP has no directive beyond the documented ones',
  Object.keys(policy).every((directive) => directive in expected.csp.page),
  Object.keys(policy)
    .filter((directive) => !(directive in expected.csp.page))
    .join(', '),
);
check('Server header does not reveal a version', !/\d/.test(header('server')), header('server'));
check('index.html is never cached', header('cache-control') === 'no-cache');

// Every answer nginx gives, its own errors included, must carry exactly the documented security headers, each once (a
// repeated X-Frame-Options is ignored by browsers, and two values do not compare equal here). The page and its files
// get the page's CSP, the API's answers the API's.
const checkSecurityHeaders = (label, response, kind = 'page') => {
  const problems = [];
  for (const [name, wanted] of Object.entries(expected.headers)) {
    const actual = response.headers.get(name);
    if (actual !== wanted) problems.push(`${name}: ${actual ?? '(missing)'}`);
  }
  const actualPolicy = response.headers.get('content-security-policy') ?? '';
  if (canonical(parsePolicy(actualPolicy)) !== canonical(expected.csp[kind]))
    problems.push(`content-security-policy: ${actualPolicy || '(missing)'}`);
  check(`${label}: all security headers, once each`, problems.length === 0, problems.join('; '));
};
checkSecurityHeaders('home page', home);

const html = await home.text();
const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
check('page references a fingerprinted script', Boolean(script));
if (script) {
  const asset = await get(script);
  check(
    'fingerprinted asset is immutable-cached',
    /immutable/.test(asset.headers.get('cache-control') ?? ''),
  );
  checkSecurityHeaders('fingerprinted script', asset);
}
check('no inline <script> in index.html', !/<script(?![^>]*\ssrc=)[^>]*>/.test(html));
check('no third-party scripts in index.html', !/<script[^>]+src="https?:\/\//.test(html));

// Files that keep their names (images, the brochure PDF) must be real files that carry the security headers and are
// never cached as immutable. A missing one must be a 404: falling back to index.html would hand out HTML under a
// .pdf name (the Vite dev server does exactly that).
const brochure = await get('/assets/KidsUp-Brosura.pdf');
const brochureBytes = Buffer.from(await brochure.arrayBuffer());
check('brochure PDF answers 200', brochure.status === 200, String(brochure.status));
check(
  'brochure is served as application/pdf',
  (brochure.headers.get('content-type') ?? '').startsWith('application/pdf'),
  brochure.headers.get('content-type') ?? '',
);
check(
  'brochure is a complete PDF',
  brochureBytes.subarray(0, 5).toString('latin1') === '%PDF-' &&
    brochureBytes.subarray(-1024).toString('latin1').includes('%%EOF'),
);
check(
  'brochure is a download, never displayed from this origin (SEC-F-17)',
  /^attachment/.test(brochure.headers.get('content-disposition') ?? ''),
  brochure.headers.get('content-disposition') ?? '(missing)',
);
checkSecurityHeaders('brochure', brochure);
check(
  'brochure is not cached as immutable (its name is not fingerprinted)',
  !/immutable/.test(brochure.headers.get('cache-control') ?? ''),
);
const certificate = await get('/assets/sertifikat-full-name.png');
const certificateBytes = Buffer.from(await certificate.arrayBuffer());
check('certificate image answers 200', certificate.status === 200, String(certificate.status));
check(
  'certificate image is served as image/png',
  (certificate.headers.get('content-type') ?? '').startsWith('image/png'),
  certificate.headers.get('content-type') ?? '',
);
check(
  'certificate image is complete (ends with the PNG IEND chunk)',
  certificateBytes.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex')),
);
checkSecurityHeaders('certificate image', certificate);

const missing = await get('/assets/missing.pdf');
check('a missing asset is a 404, not the page', missing.status === 404, String(missing.status));
checkSecurityHeaders('missing asset (nginx 404)', missing);

const staticPost = await get('/assets/KidsUp-Brosura.pdf', { method: 'POST', body: 'x' });
check('POST to a static file is refused', [403, 405].includes(staticPost.status), String(staticPost.status));
checkSecurityHeaders('refused POST to a static file', staticPost);
const homePost = await get('/', { method: 'POST', body: 'x' });
check('POST / is refused', [403, 405].includes(homePost.status), String(homePost.status));
checkSecurityHeaders('refused POST /', homePost);

const dotfile = await get('/.env');
check('dotfiles are refused (/.env)', dotfile.status === 403, String(dotfile.status));
checkSecurityHeaders('refused dotfile (nginx 403)', dotfile);

// nginx answers some requests before it has chosen a location: they must carry the headers as well.
const tooLongAddress = await get(`/${'a'.repeat(9000)}`);
check(
  'an over-long request address is refused (414)',
  tooLongAddress.status === 414,
  String(tooLongAddress.status),
);
checkSecurityHeaders('over-long request address (nginx 414)', tooLongAddress);
const malformed = await rawRequest(
  'GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\nthis line has no colon\r\n\r\n',
);
check('a malformed request is refused (400)', malformed.status === 400, String(malformed.status));
checkSecurityHeaders('malformed request (nginx 400)', malformed);

// The API: only POST /api/applications is passed on. Everything else is nginx's own answer and never reaches it.
const docs = await get('/api/docs');
check('API docs are not exposed (/api/docs -> 404)', docs.status === 404, String(docs.status));
checkSecurityHeaders('/api/docs (nginx 404)', docs, 'api');
check(
  'OpenAPI schema is not exposed (/api/openapi.json -> 404)',
  (await get('/api/openapi.json')).status === 404,
);
const health = await get('/api/health');
check('nothing but the application endpoint is passed on (/api/health -> 404)', health.status === 404);
const slash = await get('/api/applications/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
  redirect: 'manual',
});
check(
  'a trailing slash is a plain 404, not a redirect to an internal name',
  slash.status === 404 && !slash.headers.get('location'),
  `${slash.status} ${slash.headers.get('location') ?? ''}`,
);
const apiGet = await get('/api/applications');
check('GET /api/applications is refused by nginx (403)', apiGet.status === 403, String(apiGet.status));
checkSecurityHeaders('refused GET /api/applications (nginx 403)', apiGet, 'api');
// A request the API itself answers (422: no consent, nothing sent). It sets its own security headers; nginx must
// replace them, not add a second copy.
const proxied = await get('/api/applications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
});
check('the API answers an empty application with 422', proxied.status === 422, String(proxied.status));
checkSecurityHeaders('proxied API answer', proxied, 'api');
const oversized = await get('/api/applications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: 'x'.repeat(40_000),
});
check('oversized API body is refused (413)', oversized.status === 413, String(oversized.status));
checkSecurityHeaders('oversized API body (nginx 413)', oversized, 'api');

for (const { name, ok, detail } of results)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  -> ${detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
