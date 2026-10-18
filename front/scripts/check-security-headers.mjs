// Verifies the security posture of a RUNNING stack (see docs/security-standards.md, SEC-F-02 / SEC-F-11).
//   npm run check:headers                      -> http://localhost:8080
//   npm run check:headers -- https://kidsup.az
// Exits with code 1 if any check fails. Needs Node 18+ (built-in fetch); no dependencies.

const base = (process.argv[2] ?? 'http://localhost:8080').replace(/\/$/, '');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });

const home = await fetch(base + '/');
const header = (name) => home.headers.get(name) ?? '';
const csp = header('content-security-policy');

check('home page answers 200', home.status === 200, String(home.status));
for (const directive of [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "require-trusted-types-for 'script'",
]) {
  check(`CSP contains ${directive}`, csp.includes(directive));
}
check(
  "CSP has no 'unsafe-inline' / 'unsafe-eval' / wildcard",
  !/unsafe-inline|unsafe-eval|\s\*[\s;]|\s\*$/.test(csp),
  csp,
);
check(
  "CSP allows images from 'self' only (no third-party origin)",
  /(^|;\s*)img-src 'self'\s*(;|$)/.test(csp),
  csp,
);
check('X-Content-Type-Options: nosniff', header('x-content-type-options') === 'nosniff');
check('X-Frame-Options: DENY', header('x-frame-options') === 'DENY');
check('Referrer-Policy: no-referrer', header('referrer-policy') === 'no-referrer');
check('Cross-Origin-Opener-Policy: same-origin', header('cross-origin-opener-policy') === 'same-origin');
check('Cross-Origin-Resource-Policy: same-origin', header('cross-origin-resource-policy') === 'same-origin');
check('Permissions-Policy is set', header('permissions-policy') !== '');
check(
  'Strict-Transport-Security >= 1 year',
  /max-age=(\d+)/.test(header('strict-transport-security')) &&
    Number(/max-age=(\d+)/.exec(header('strict-transport-security'))[1]) >= 31536000,
);
check('Server header does not reveal a version', !/\d/.test(header('server')), header('server'));
check('index.html is never cached', header('cache-control') === 'no-cache');

const html = await home.text();
const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
check('page references a fingerprinted script', Boolean(script));
if (script) {
  const asset = await fetch(base + script);
  check(
    'fingerprinted asset is immutable-cached',
    /immutable/.test(asset.headers.get('cache-control') ?? ''),
  );
}
check('no inline <script> in index.html', !/<script(?![^>]*\ssrc=)[^>]*>/.test(html));
check('no third-party scripts in index.html', !/<script[^>]+src="https?:\/\//.test(html));

const status = async (path, init) => (await fetch(base + path, init)).status;

// Files that keep their names (images, the brochure PDF) must be real files that carry the security headers and are
// never cached as immutable. A missing one must be a 404: falling back to index.html would hand out HTML under a
// .pdf name (the Vite dev server does exactly that).
const brochure = await fetch(base + '/assets/KidsUp-Brosura.pdf');
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
check('brochure carries nosniff', brochure.headers.get('x-content-type-options') === 'nosniff');
check(
  'brochure carries the CSP',
  (brochure.headers.get('content-security-policy') ?? '').includes("default-src 'self'"),
);
check(
  'brochure is not cached as immutable (its name is not fingerprinted)',
  !/immutable/.test(brochure.headers.get('cache-control') ?? ''),
);
const certificate = await fetch(base + '/assets/sertifikat-full-name.png');
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
check('certificate image carries nosniff', certificate.headers.get('x-content-type-options') === 'nosniff');
check('a missing asset is a 404, not the page', (await status('/assets/missing.pdf')) === 404);

check('POST / is refused', [403, 405].includes(await status('/', { method: 'POST', body: 'x' })));
check('dotfiles are refused (/.env)', (await status('/.env')) === 403);
check('API docs are not exposed (/api/docs -> 404)', (await status('/api/docs')) === 404);
check(
  'OpenAPI schema is not exposed (/api/openapi.json -> 404)',
  (await status('/api/openapi.json')) === 404,
);
check(
  'oversized API body is refused (413)',
  (await status('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'x'.repeat(40_000),
  })) === 413,
);

for (const { name, ok, detail } of results)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  -> ${detail}` : ''}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
process.exit(failed ? 1 : 0);
