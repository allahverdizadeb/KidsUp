import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitApplication, type ApplicationPayload } from './applications';

const payload: ApplicationPayload = {
  parent_name: 'Aysel',
  phone: '+994 50 123 45 67',
  children: [{ name: 'Leyla', birth_date: '2016-03-14' }],
  languages: ['Azərbaycan'],
  consent: true,
  privacy_notice_version: '2026-10-19-draft',
};

describe('submitApplication', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('posts the payload as JSON to the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await submitApplication(payload);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/applications');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('resolves with nothing: the answer of the server is neither read nor trusted', async () => {
    const json = vi.fn().mockResolvedValue({ id: 'abc' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json }));

    await expect(submitApplication(payload)).resolves.toBeUndefined();

    expect(json).not.toHaveBeenCalled();
  });

  it('gives up after ten seconds instead of waiting forever', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await submitApplication(payload);

    expect(timeout).toHaveBeenCalledExactlyOnceWith(10_000);
    const signal: AbortSignal = fetchMock.mock.calls[0][1].signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it('rejects when the network call fails or is aborted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')));
    await expect(submitApplication(payload)).rejects.toThrow('timed out');
  });

  it.each([422, 429, 500])('rejects when the API answers %i', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
    await expect(submitApplication(payload)).rejects.toThrow(String(status));
  });
});
