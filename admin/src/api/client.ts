/**
 * The one place that talks to the panel API (same origin, `/api/admin`). The session is an HttpOnly cookie the
 * browser sends by itself; the only secret this code holds is the CSRF token, in memory (never in storage).
 */

const BASE = '/api/admin';
const TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 60_000;

/** A refused or failed request. `code` is the API's stable code; `body` is the whole answer (never shown as is). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly body: Record<string, unknown>;

  constructor(status: number, code: string | null, body: Record<string, unknown> = {}) {
    super(code ?? `http_${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }

  /** The names of the fields a 422 refused (`loc` ends with the field), without any value. */
  get fields(): string[] {
    const detail = this.body.detail;
    if (!Array.isArray(detail)) return [];
    return detail.flatMap((fault: unknown) => {
      // Whatever came back is read with care: an answer that is not in the API's shape names no field.
      const loc = typeof fault === 'object' && fault !== null && 'loc' in fault ? fault.loc : undefined;
      const last = Array.isArray(loc) ? (loc[loc.length - 1] as unknown) : undefined;
      return typeof last === 'string' ? [last] : [];
    });
  }
}

let csrfToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

/** The session layer listens here: any answer 401 (except the sign-in's own) means the session is over. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export interface RequestOptions {
  body?: unknown;
  /** A raw body (a picture) with its type; sent as it is. */
  raw?: { data: Blob; type: string };
  /** The page asked by itself, nobody did: the request does not extend the session (an idle screen must end). */
  background?: boolean;
  /** Sign-in only: a 401 there is a wrong password, not an expired session. */
  anonymous?: boolean;
}

/** What a page may choose for a read it sends. */
export type ReadOptions = Pick<RequestOptions, 'background'>;

async function send(method: string, path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.raw) {
    headers['Content-Type'] = options.raw.type;
    body = options.raw.data;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  if (options.background) headers['X-Background'] = 'poll';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.raw ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS);
  try {
    return await fetch(BASE + path, {
      method,
      headers,
      body,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    // Nothing reached the API (offline, reset, timed out): one error for every such case.
    throw new ApiError(0, 'network');
  } finally {
    clearTimeout(timer);
  }
}

async function readError(response: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    // An answer that is not JSON (a proxy's page) carries nothing the page may show.
  }
  const code = typeof body.code === 'string' ? body.code : null;
  return new ApiError(response.status, code, body);
}

async function call(method: string, path: string, options: RequestOptions): Promise<Response> {
  const response = await send(method, path, options);
  if (response.ok) return response;
  const error = await readError(response);
  if (response.status === 401 && !options.anonymous) onUnauthorized?.();
  throw error;
}

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await call(method, path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** A file the API makes (the CSV export): its bytes and the name it suggests. */
export async function download(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ blob: Blob; filename: string }> {
  const response = await call(method, path, options);
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'export.csv';
  return { blob: await response.blob(), filename };
}

export const get = <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options);
export const post = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>('POST', path, { ...options, body });
export const put = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>('PUT', path, { ...options, body });
export const patch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  request<T>('PATCH', path, { ...options, body });
export const del = <T = void>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options);
