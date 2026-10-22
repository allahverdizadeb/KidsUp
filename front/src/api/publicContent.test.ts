import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPublicContent, parseCourse, parseCourses, parseSite } from './publicContent';

const COURSE = {
  id: '00000000-0000-4000-8000-000000000001',
  title: '6 həftəlik KidsUp proqramı',
  start_date: '2026-12-05',
  schedule: 'şənbə, 09:30–13:00',
  location: 'Bakı',
  age_min: 8,
  age_max: 13,
  price_minor: 65_000,
  second_child_price_minor: 50_000,
  currency: 'AZN',
  capacity: 20,
  seats_left: 20,
  accepting_applications: true,
};

describe('parseCourse', () => {
  it('reads a course as the panel publishes it', () => {
    expect(parseCourse(COURSE)).toEqual({
      id: COURSE.id,
      title: COURSE.title,
      startDate: '2026-12-05',
      schedule: 'şənbə, 09:30–13:00',
      location: 'Bakı',
      ageMin: 8,
      ageMax: 13,
      priceMinor: 65_000,
      secondChildPriceMinor: 50_000,
      capacity: 20,
      seatsLeft: 20,
      isAcceptingApplications: true,
    });
  });

  it.each([
    ['not an object', 'text'],
    ['an array', [COURSE]],
    ['a missing id', { ...COURSE, id: undefined }],
    ['an empty title', { ...COURSE, title: '' }],
    ['a date that is not ISO', { ...COURSE, start_date: '5 dekabr 2026' }],
    ['another currency', { ...COURSE, currency: 'USD' }],
    ['a price as text', { ...COURSE, price_minor: '65000' }],
    ['a fractional price', { ...COURSE, price_minor: 650.5 }],
    ['a negative price', { ...COURSE, second_child_price_minor: -1 }],
    ['no places', { ...COURSE, capacity: 0 }],
    ['seats beyond the maximum', { ...COURSE, seats_left: 501 }],
    ['an adult age', { ...COURSE, age_max: 26 }],
    ['an acceptance flag as text', { ...COURSE, accepting_applications: 'yes' }],
    ['an over-long title', { ...COURSE, title: 'x'.repeat(301) }],
  ])('refuses a course with %s', (_what, value) => {
    expect(parseCourse(value)).toBeNull();
  });
});

describe('parseCourses and parseSite', () => {
  it('keeps the good courses of a list and drops the bad ones', () => {
    const parsed = parseCourses({ courses: [COURSE, { ...COURSE, capacity: 0 }, 'junk'] });

    expect(parsed?.map((course) => course.id)).toEqual([COURSE.id]);
  });

  it.each([null, 'text', [], { courses: 'none' }, {}])('treats %j as "the list is unknown"', (file) => {
    expect(parseCourses(file)).toBeNull();
  });

  it('is an empty list, not an unknown one, when no course is open', () => {
    expect(parseCourses({ courses: [] })).toEqual([]);
  });

  it('reads the published places, and nothing when the file is not as expected', () => {
    expect(parseSite({ version: 3, content: { 'hero.title_first': 'Yeni' } })).toEqual({
      'hero.title_first': 'Yeni',
    });
    for (const file of [null, 'text', [], { content: 'text' }, { content: ['a'] }, {}]) {
      expect(parseSite(file)).toEqual({});
    }
  });
});

describe('loadPublicContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const answer = (body: unknown, contentType = 'application/json') =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': contentType },
    });

  it('reads both files, without letting the browser keep an old copy', async () => {
    const fetchMock = vi.fn<typeof fetch>((url) =>
      Promise.resolve(
        String(url).endsWith('site.json')
          ? answer({ version: 1, content: { 'hero.title_first': 'Yeni' } })
          : answer({ courses: [COURSE] }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const content = await loadPublicContent();

    expect(content.site).toEqual({ 'hero.title_first': 'Yeni' });
    expect(content.courses?.[0]?.id).toBe(COURSE.id);
    const urls = fetchMock.mock.calls.map(([url]) => String(url)).sort();
    expect(urls).toEqual(['/content/courses.json', '/content/site.json']);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toMatchObject({ cache: 'no-cache' });
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('gives up on a file after two seconds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(answer({ courses: [] }))),
    );
    const timeout = vi.spyOn(AbortSignal, 'timeout');

    await loadPublicContent();

    expect(timeout).toHaveBeenCalledWith(2000);
  });

  it('falls back to nothing published when the files are missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Not found', { status: 404 })));

    expect(await loadPublicContent()).toEqual({ site: {}, courses: null });
  });

  it('falls back to nothing when the server answers with its page instead of JSON (development)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(answer('<html></html>', 'text/html'))),
    );

    expect(await loadPublicContent()).toEqual({ site: {}, courses: null });
  });

  it('falls back to nothing when the network fails or is too slow', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError')));

    expect(await loadPublicContent()).toEqual({ site: {}, courses: null });
  });

  it('falls back to nothing when a file is not JSON, or is far larger than any real one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(answer('{broken'))),
    );
    expect(await loadPublicContent()).toEqual({ site: {}, courses: null });

    const huge = JSON.stringify({ courses: [], padding: 'x'.repeat(1_000_001) });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(answer(huge))),
    );
    expect(await loadPublicContent()).toEqual({ site: {}, courses: null });
  });

  it('does not read a file whose declared size is over the cap', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('the body must not be read');
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(body, {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Content-Length': '1000001' },
          }),
        ),
      ),
    );

    expect(await loadPublicContent()).toEqual({ site: {}, courses: null });
  });

  it('stops reading a file that grows past the cap, whatever it declared', async () => {
    let chunksRead = 0;
    const chunk = new TextEncoder().encode('x'.repeat(200_000));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunksRead += 1;
        controller.enqueue(chunk);
        if (chunksRead >= 50) controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })),
      ),
    );

    expect(await loadPublicContent()).toEqual({ site: {}, courses: null });
    expect(chunksRead).toBeLessThan(10); // 50 chunks (10 MB) were on offer; it gave up after about five
  });

  it('reads a file that arrives in several pieces, with letters of every size in it', async () => {
    const whole = new TextEncoder().encode(JSON.stringify({ content: { 'hero.title_first': 'Şənbə və ə' } }));
    const middle = whole.length - 7; // cuts through a letter of two bytes
    const pieces = [whole.slice(0, middle), whole.slice(middle)];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const piece of pieces) controller.enqueue(piece);
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: RequestInfo | URL) =>
        Promise.resolve(
          String(url).endsWith('site.json')
            ? new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } })
            : answer({ courses: [] }),
        ),
      ),
    );

    expect((await loadPublicContent()).site).toEqual({ 'hero.title_first': 'Şənbə və ə' });
  });

  it('falls back to nothing when an answer has no body at all', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response(null, { status: 200, headers: { 'Content-Type': 'application/json' } })),
      ),
    );

    expect(await loadPublicContent()).toEqual({ site: {}, courses: null });
  });

  it('never throws, whatever the files hold', async () => {
    const file = { content: { a: 1 }, courses: [null, 1, {}] };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(answer(file))),
    );

    await expect(loadPublicContent()).resolves.toEqual({ site: { a: 1 }, courses: [] });
  });
});
