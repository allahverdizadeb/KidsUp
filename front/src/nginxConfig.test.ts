import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The nginx files are read as text. `npm run check:headers` against a running stack is the live check.
const NGINX_DIRECTORY = resolve(import.meta.dirname, '../nginx');
const readNginxFile = (name: string): string => readFileSync(resolve(NGINX_DIRECTORY, name), 'utf8');
const SECURITY_HEADERS_INCLUDE = 'include /etc/nginx/snippets/security-headers.conf;';
const CSP_PAGE_INCLUDE = 'include /etc/nginx/snippets/csp-page.conf;';
const CSP_API_INCLUDE = 'include /etc/nginx/snippets/csp-api.conf;';

type ExpectedHeaders = {
  headers: Record<string, string>;
  csp: { page: Record<string, string[]>; api: Record<string, string[]> };
};
// The same file the live check reads, so the two cannot drift apart.
const expected: ExpectedHeaders = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../scripts/expected-headers.json'), 'utf8'),
);

const defaultConf = readNginxFile('default.conf');

type Block = { header: string; body: string; start: number; end: number };

/** The text inside `{ ... }` for every block whose first line starts with `keyword` and ends with `{`. */
const readBlocks = (conf: string, keyword: RegExp): Block[] => {
  const blocks: Block[] = [];
  // The opening brace is the last character of the line: a pattern such as `{8}` inside it must not count.
  const blockStart = new RegExp(String.raw`^[ \t]*${keyword.source}[^\n]*\{[ \t]*$`, 'gm');
  for (const match of conf.matchAll(blockStart)) {
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let end = bodyStart;
    while (depth > 0 && end < conf.length) {
      if (conf[end] === '{') depth++;
      if (conf[end] === '}') depth--;
      end++;
    }
    blocks.push({
      header: match[0].slice(0, -1).trim(),
      body: conf.slice(bodyStart, end - 1),
      start: match.index,
      end,
    });
  }
  return blocks;
};

/** The text outside the given blocks: what the enclosing `server { ... }` sets for itself. */
const withoutBlocks = (conf: string, blocks: Block[]): string =>
  [...blocks].reverse().reduce((rest, { start, end }) => rest.slice(0, start) + rest.slice(end), conf);

/** Every `add_header Name "value" always;` in a file, by lower-case name. */
const readAddedHeaders = (conf: string): Record<string, string> =>
  Object.fromEntries(
    [...conf.matchAll(/^add_header (\S+) "([^"]*)" always;$/gm)].map((match) => [
      match[1].toLowerCase(),
      match[2],
    ]),
  );

const parsePolicy = (policy: string): Record<string, string[]> =>
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

describe('nginx configuration', () => {
  const locations = readBlocks(defaultConf, /location\s/);
  const serverLevel = withoutBlocks(defaultConf, locations);

  it('sends the shared security headers from every location (SEC-F-11)', () => {
    expect(locations.length).toBeGreaterThanOrEqual(7);
    for (const { header, body } of locations) {
      expect(body, `${header} does not include the security headers`).toContain(SECURITY_HEADERS_INCLUDE);
    }
  });

  it('gives the page and its files the page’s content security policy, and nothing else', () => {
    const pageLocations = locations.filter(({ header }) => !header.includes('/api/'));
    expect(pageLocations.length).toBeGreaterThanOrEqual(5);
    for (const { header, body } of pageLocations) {
      expect(body, `${header} lacks the page's CSP`).toContain(CSP_PAGE_INCLUDE);
      expect(body, `${header} also has the API's CSP`).not.toContain(CSP_API_INCLUDE);
    }
  });

  it('gives every API location the API’s strict content security policy (SEC-B-11)', () => {
    const apiLocations = locations.filter(({ header }) => header.includes('/api/'));
    expect(apiLocations).toHaveLength(2);
    for (const { header, body } of apiLocations) {
      expect(body, `${header} lacks the API's CSP`).toContain(CSP_API_INCLUDE);
      expect(body, `${header} also has the page's CSP`).not.toContain(CSP_PAGE_INCLUDE);
    }
  });

  it('also sends them for the answers nginx gives before it has chosen a location (400, 414, 431)', () => {
    expect(serverLevel).toContain(SECURITY_HEADERS_INCLUDE);
    expect(serverLevel).toContain(CSP_PAGE_INCLUDE);
  });

  it('passes on exactly one API endpoint, and only POST to it', () => {
    const endpoint = locations.find(({ header }) => header === 'location = /api/applications');
    expect(endpoint?.body).toMatch(/if \(\$request_method != POST\) \{\s*return 405;\s*\}/);
    expect(endpoint?.body).toMatch(/proxy_pass \$api_upstream;/);

    const rest = locations.find(({ header }) => header === 'location /api/');
    expect(rest?.body).toContain('return 404;');
    expect(rest?.body).not.toContain('proxy_pass');
    expect(defaultConf.match(/proxy_pass/g)).toHaveLength(1);
  });

  it('refuses any other method before the rate limiter, so refused requests do not use up the budget', () => {
    const endpoint = locations.find(({ header }) => header === 'location = /api/applications')?.body ?? '';
    const refusal = endpoint.indexOf('if ($request_method != POST)');
    expect(refusal, 'the method check is missing').toBeGreaterThanOrEqual(0);
    expect(endpoint.slice(refusal)).toMatch(/^if \(\$request_method != POST\) \{\s*return 405;\s*\}/);
    expect(refusal).toBeLessThan(endpoint.indexOf('limit_req zone=api'));
    // limit_except would give the request its own empty rewrite rules, so the check above would never run for GET.
    expect(endpoint).not.toMatch(/^\s*limit_except\s/m);
  });

  it('rate-limits the one API endpoint per visitor address (SEC-B-08)', () => {
    expect(defaultConf).toMatch(/^limit_req_zone \$binary_remote_addr zone=api:\d+m rate=\d+r\/m;$/m);
    const endpoint = locations.find(({ header }) => header === 'location = /api/applications')?.body ?? '';
    expect(endpoint).toMatch(/limit_req zone=api burst=\d+ nodelay;/);
    expect(endpoint).toContain('limit_req_status 429;');
  });

  it('limits how many requests one address may hold open, and ends slow or timed-out connections (SEC-B-08)', () => {
    // limit_req counts a request when it starts; a body sent a byte at a time or a file read slowly holds a connection.
    expect(defaultConf).toMatch(/^limit_conn_zone \$binary_remote_addr zone=conn_per_address:\d+m;$/m);
    expect(defaultConf).toMatch(/^\s*limit_conn conn_per_address \d+;$/m);
    expect(defaultConf).toContain('limit_conn_status 429;');
    const endpoint = locations.find(({ header }) => header === 'location = /api/applications')?.body ?? '';
    const atOnce = /limit_conn conn_per_address (\d+);/.exec(endpoint)?.[1];
    expect(Number(atOnce)).toBeGreaterThan(0);
    expect(Number(atOnce)).toBeLessThanOrEqual(5); // the form is one small request
    expect(defaultConf).toMatch(/^\s*reset_timedout_connection on;$/m);
    expect(Number(/^\s*client_body_timeout (\d+)s;$/m.exec(defaultConf)?.[1])).toBeLessThanOrEqual(5);
    expect(Number(/^\s*send_timeout (\d+)s;$/m.exec(defaultConf)?.[1])).toBeLessThanOrEqual(20);
  });

  it('tells the API who the visitor is by overwriting X-Forwarded-For, never by appending to it', () => {
    expect(defaultConf).toContain('proxy_set_header X-Forwarded-For $remote_addr;');
    // $proxy_add_x_forwarded_for keeps whatever the visitor sent, which would let them choose their own address.
    expect(defaultConf).not.toContain('$proxy_add_x_forwarded_for');
  });

  it('caps the request body at what the form needs', () => {
    expect(defaultConf).toMatch(/^\s*client_max_body_size 16k;$/m);
  });

  it('looks the API up again as it changes instead of keeping the address seen at start-up', () => {
    expect(defaultConf).toMatch(/^\s*resolver 127\.0\.0\.11 valid=\d+s ipv6=off;$/m);
    expect(defaultConf).toMatch(/set \$api_upstream http:\/\/back:8000;/);
  });

  it('replaces the headers the API sets instead of repeating them (a repeated X-Frame-Options is ignored)', () => {
    const api = locations.find(({ header }) => header === 'location = /api/applications');
    const sentByNginx = Object.keys(expected.headers).concat('content-security-policy');
    for (const name of sentByNginx) {
      expect(api?.body.toLowerCase(), `the API's ${name} is not dropped`).toContain(
        `proxy_hide_header ${name};`,
      );
    }
  });

  it('does not let the API steer nginx with X-Accel-* response headers', () => {
    const api = locations.find(({ header }) => header === 'location = /api/applications');
    expect(api?.body).toMatch(/proxy_ignore_headers[^;]*X-Accel-Redirect[^;]*;/);
  });

  it('serves the brochure as a download, never as a page of this origin (SEC-F-17)', () => {
    const pdf = locations.find(({ header }) => header.includes('.pdf'));
    expect(pdf?.body).toContain('add_header Content-Disposition "attachment" always;');
  });

  it('accepts only GET and HEAD for the page and the static files', () => {
    const served = locations.filter(({ header }) => header === 'location /' || header.includes('/assets/'));
    expect(served.length).toBe(4);
    for (const { header, body } of served) {
      expect(body, `${header} accepts other methods`).toMatch(/limit_except GET HEAD \{\s*deny all;\s*\}/);
    }
  });

  describe('what the admin panel published', () => {
    const published = (header: string) =>
      locations.find((location) => location.header === header)?.body ?? '';
    const mediaHeader = locations.find(({ header }) => header.includes('/media/['))?.header ?? '';

    it.each(['location = /content/site.json', 'location = /content/courses.json'])(
      'serves %s read-only from the content volume, always asking whether it changed',
      (header) => {
        const body = published(header);
        expect(body).toMatch(/limit_except GET HEAD \{\s*deny all;\s*\}/);
        expect(body).toContain('add_header Cache-Control "no-cache" always;');
        expect(body).toContain('root /usr/share/nginx;');
        expect(body).toContain('try_files $uri =404;');
      },
    );

    it('serves only picture files with a random id as their name, and caches them for a day only', () => {
      expect(mediaHeader).toMatch(/\^\/media\/\[0-9a-f\]\{8\}-.*\\\.webp\$/);
      const body = published(mediaHeader);
      expect(body).toMatch(/limit_except GET HEAD \{\s*deny all;\s*\}/);
      // Not for good: a picture that has to go (a parent withdraws consent for a photo) must leave caches next day.
      expect(body).toContain('add_header Cache-Control "public, max-age=86400" always;');
      expect(body).not.toContain('immutable');
      expect(body).toContain('root /usr/share/nginx/content;');
      expect(body).toContain('disable_symlinks on from=$document_root;'); // a link planted in the volume leads nowhere
      expect(body).toContain('try_files $uri =404;');
    });

    it.each(['location /content/', 'location /media/'])(
      'answers 404 for anything else under %s, never the page and never a listing',
      (header) => {
        const body = published(header);
        expect(body).toContain('return 404;');
        expect(body).not.toMatch(/autoindex|try_files|proxy_pass/);
      },
    );

    it('keeps the temporary files the panel writes while it replaces a file out of reach (dotfiles)', () => {
      expect(defaultConf).toMatch(/location ~ \/\\\.\(\?!well-known\) \{[^}]*deny all;/);
    });
  });

  it('logs nothing but a shortened address, the time, the path and the outcome (privacy)', () => {
    const format = /log_format privacy ([^;]+);/.exec(defaultConf)?.[1] ?? '';
    const logged = [...format.matchAll(/\$([a-z_]+)/g)].map((match) => match[1]);
    // An allow-list: $uri has no query string; $request_uri, $remote_addr, $http_* or $args would carry personal data.
    const allowed = [
      'anonymised_address',
      'time_local',
      'request_method',
      'uri',
      'status',
      'body_bytes_sent',
    ];
    expect(logged.filter((variable) => !allowed.includes(variable))).toEqual([]);
    expect(logged).toContain('anonymised_address');
    expect(defaultConf).toContain('access_log /var/log/nginx/access.log privacy;');
  });

  it('cuts an address to its network before it is logged', () => {
    const map = /map \$remote_addr \$anonymised_address \{([^}]+)\}/.exec(defaultConf)?.[1] ?? '';
    expect(map).toContain('$network.0;'); // IPv4: the last octet is zeroed
    expect(map).toContain('$network::;'); // IPv6: only the first three groups are kept
    expect(map).toMatch(/default\s+0\.0\.0\.0;/); // anything else is not logged at all
  });

  it('keeps full client addresses out of the error log, which cannot be anonymised', () => {
    expect(defaultConf).toMatch(/error_log \/var\/log\/nginx\/error\.log crit;/);
  });

  it('trusts no proxy address until one is configured, and never everybody', () => {
    const active = readNginxFile('real-ip.conf')
      .split('\n')
      .filter((line) => !line.trim().startsWith('#') && line.trim() !== '');
    expect(active.join('\n')).not.toMatch(/set_real_ip_from\s+(0\.0\.0\.0\/0|::\/0)/);
  });
});

describe('nginx security headers', () => {
  it('sends exactly the documented headers, with the documented values (SEC-F-11)', () => {
    expect(readAddedHeaders(readNginxFile('security-headers.conf'))).toEqual(expected.headers);
  });

  it('has a strict policy for the page: only its own origin, no unsafe keyword (SEC-F-02, SEC-F-03)', () => {
    const headers = readAddedHeaders(readNginxFile('csp-page.conf'));
    expect(Object.keys(headers)).toEqual(['content-security-policy']);
    const policy = parsePolicy(headers['content-security-policy']);
    expect(policy).toEqual(expected.csp.page);
    expect(JSON.stringify(policy)).not.toMatch(/unsafe-|https?:|\*|data:/);
  });

  it('allows the API’s answers to load and frame nothing (SEC-B-11)', () => {
    const headers = readAddedHeaders(readNginxFile('csp-api.conf'));
    expect(Object.keys(headers)).toEqual(['content-security-policy']);
    expect(parsePolicy(headers['content-security-policy'])).toEqual(expected.csp.api);
  });
});

describe('web image', () => {
  const dockerfile = readFileSync(resolve(import.meta.dirname, '../Dockerfile'), 'utf8');

  it('ends as the unprivileged nginx user, whatever it did as root while building (SEC-F-12)', () => {
    const users = [...dockerfile.matchAll(/^USER (\S+)$/gm)].map((match) => match[1]);
    expect(users.at(-1)).toBe('101');
  });

  it('ships every nginx file that default.conf includes', () => {
    const included = [...defaultConf.matchAll(/include \/etc\/nginx\/snippets\/(\S+);/g)].map(
      (match) => match[1],
    );
    expect(new Set(included)).toEqual(
      new Set(['security-headers.conf', 'csp-page.conf', 'csp-api.conf', 'real-ip.conf']),
    );
    for (const name of included) {
      expect(dockerfile, `${name} is not copied into the image`).toContain(
        `COPY nginx/${name} /etc/nginx/snippets/${name}`,
      );
    }
  });
});
