import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  del,
  download,
  get,
  patch,
  post,
  put,
  request,
  setCsrfToken,
  setUnauthorizedHandler,
} from './client.ts';

function answer(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const stub = (response: Response | Error) => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response;
    return response.clone();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};
const sent = (mock: ReturnType<typeof stub>) => {
  const call = mock.mock.calls[0] as [string, RequestInit];
  return { url: call[0], init: call[1], headers: call[1].headers as Record<string, string> };
};

/** The error a call fails with; the test fails if it does not. */
async function failure(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error('the call was expected to fail');
}

afterEach(() => {
  setCsrfToken(null);
  setUnauthorizedHandler(null);
});

describe('requests', () => {
  it('goes to the panel API of the same origin, with the session cookie and no cache', async () => {
    const mock = stub(answer(200, { ok: true }));

    await expect(get('/dashboard')).resolves.toEqual({ ok: true });

    const { url, init, headers } = sent(mock);
    expect(url).toBe('/api/admin/dashboard');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
    expect(headers.Accept).toBe('application/json');
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });

  it('sends the CSRF token with every request that changes something, and with none that only reads', async () => {
    setCsrfToken('secret-token');
    const mock = stub(answer(200));
    await get('/courses');
    await post('/courses', { a: 1 });
    await put('/content', { values: {} });
    await patch('/courses/1', { a: 1 });
    mock.mockImplementation(async () => answer(204));
    await del('/courses/1');

    const methods = mock.mock.calls.map(([, init]) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      return [init?.method, headers['X-CSRF-Token']];
    });
    expect(methods).toEqual([
      ['GET', undefined],
      ['POST', 'secret-token'],
      ['PUT', 'secret-token'],
      ['PATCH', 'secret-token'],
      ['DELETE', 'secret-token'],
    ]);
  });

  it('sends a body as JSON, and a picture as it is with its own type', async () => {
    const mock = stub(answer(201));
    await post('/x', { a: 1 });
    expect(sent(mock).headers['Content-Type']).toBe('application/json');
    expect(sent(mock).init.body).toBe('{"a":1}');

    const file = new Blob(['x'], { type: 'image/png' });
    await request('POST', '/media', { raw: { data: file, type: 'image/png' } });
    const second = mock.mock.calls[1] as [string, RequestInit];
    expect((second[1].headers as Record<string, string>)['Content-Type']).toBe('image/png');
    expect(second[1].body).toBe(file);
  });

  it('marks a poll as background', async () => {
    const mock = stub(answer(200));
    await get('/applications/pulse', { background: true });
    expect(sent(mock).headers['X-Background']).toBe('poll');
  });

  it('answers undefined for a 204', async () => {
    stub(answer(204));
    await expect(del('/x')).resolves.toBeUndefined();
  });
});

describe('failures', () => {
  it('carries the status, the code and the answer, and names the fields a 422 refused', async () => {
    stub(
      answer(422, {
        detail: [
          { loc: ['body', 'start_date'], type: 'date' },
          { loc: ['body', 'capacity'], type: 'int' },
          { loc: [], type: 'x' },
        ],
      }),
    );

    const error = await failure(get('/x'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.code).toBeNull();
    expect(error.fields).toEqual(['start_date', 'capacity']);
  });

  it('has no fields when the detail is a sentence', async () => {
    stub(answer(409, { detail: 'No.', code: 'not_enough_seats', needed: 2 }));
    const error = await failure(get('/x'));
    expect(error.code).toBe('not_enough_seats');
    expect(error.body.needed).toBe(2);
    expect(error.fields).toEqual([]);
  });

  it('reads an answer that is not in the API’s shape with care: it names no field and does not throw', async () => {
    stub(
      answer(422, {
        detail: [null, 7, 'x', { loc: 'start_date' }, { loc: [7] }, { loc: ['body', 'capacity'] }],
      }),
    );

    const error = await failure(get('/x'));

    expect(error.fields).toEqual(['capacity']);
  });

  it('copes with an answer that is not JSON (a proxy page)', async () => {
    stub(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await failure(get('/x'));
    expect(error).toMatchObject({ status: 502, code: null });
    expect(error.body).toEqual({});
  });

  it('reports an offline browser as status 0', async () => {
    stub(new TypeError('Failed to fetch'));
    const error = await failure(get('/x'));
    expect(error).toMatchObject({ status: 0, code: 'network' });
  });

  it('gives up on a server that does not answer, after thirty seconds (a picture gets sixty)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // A server that never answers: the request ends only when the page aborts it.
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const outcome = vi.fn();
    void get('/x').catch(outcome);
    const upload = vi.fn();
    void request('POST', '/media', { raw: { data: new Blob(['x']), type: 'image/png' } }).catch(upload);

    await vi.advanceTimersByTimeAsync(29_999);
    expect(outcome).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(outcome).toHaveBeenCalledTimes(1);
    expect(outcome.mock.calls[0]?.[0]).toMatchObject({ status: 0, code: 'network' });

    expect(upload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('tells the session layer about a 401, except for the sign-in itself', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stub(answer(401, { code: 'not_authenticated' }));

    await get('/dashboard').catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);

    await request('POST', '/sessions', { anonymous: true }).catch(() => undefined);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('downloads', () => {
  it('returns the bytes and the name the API suggests', async () => {
    stub(
      new Response('a;b', {
        status: 200,
        headers: { 'Content-Disposition': 'attachment; filename="muracietler.csv"' },
      }),
    );
    const file = await download('POST', '/applications/export', { body: {} });
    expect(file.filename).toBe('muracietler.csv');
    expect(await file.blob.text()).toBe('a;b');
  });

  it('has a name of its own when the API suggests none', async () => {
    stub(new Response('x', { status: 200 }));
    expect((await download('POST', '/x')).filename).toBe('export.csv');
  });
});
