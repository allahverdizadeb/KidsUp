import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitApplication, type ApplicationPayload } from './applications';

const payload: ApplicationPayload = {
  parent_name: 'Aysel',
  phone: '+994 50 123 45 67',
  children: [{ name: 'Leyla', birth_date: '2016-03-14' }],
  languages: ['Azərbaycan'],
};

describe('submitApplication', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts JSON to the API and returns the created id', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'abc' }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(submitApplication(payload)).resolves.toEqual({ id: 'abc' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/applications');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual(payload);
  });

  it('gives up after a timeout instead of waiting forever', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'abc' }) });
    vi.stubGlobal('fetch', fetchMock);
    await submitApplication(payload);
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
