import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.tsx';
import { setEdit, useEdits } from './state/cmsEdits.ts';
import { openApp, setViewportWidth, signInThroughForm } from './test/app.tsx';
import type { Opened } from './test/app.tsx';
import { CODE, FakeBackend, PASSWORD } from './test/fakeBackend.ts';
import { ago, makeApplication } from './test/fixtures.ts';

const navigation = () => within(screen.getByRole('navigation', { name: 'Admin menyu' }));

describe('signing in', () => {
  it('shows nothing but the sign-in form when nobody is signed in', async () => {
    await openApp({ signedIn: false });

    expect(screen.getByRole('heading', { name: 'Daxil ol' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin menyu' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Valideyn/)).not.toBeInTheDocument();
  });

  it('asks for what is missing before it asks the server', async () => {
    const { user, backend } = await openApp({ signedIn: false });

    await user.click(screen.getByRole('button', { name: 'Daxil ol' }));

    expect(screen.getByText('E-poçtu daxil edin.')).toBeInTheDocument();
    expect(screen.getByText('Şifrəni daxil edin.')).toBeInTheDocument();
    expect(screen.getByText('Kod 6 rəqəmdən ibarətdir.')).toBeInTheDocument();
    expect(backend.called('POST', '/sessions')).toHaveLength(0);
  });

  it('takes the focus to the first box that needs an answer, and keeps the message out of that box’s name', async () => {
    const { user } = await openApp({ signedIn: false });

    await user.click(screen.getByRole('button', { name: 'Daxil ol' }));

    const email = screen.getByRole('textbox', { name: 'E-poçt' }); // the name is the label alone
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription('E-poçtu daxil edin.');
    expect(screen.getByText('E-poçtu daxil edin.')).toHaveAttribute('role', 'alert');
  });

  it('is sent with POST, so that if the page’s script never starts nothing goes into the address', async () => {
    await openApp({ signedIn: false });

    expect(document.querySelector('form')).toHaveAttribute('method', 'post');
    expect(screen.getByLabelText('Birdəfəlik kod')).toHaveAttribute('spellcheck', 'false');
  });

  it('takes digits only in the code and no more than six', async () => {
    const { user } = await openApp({ signedIn: false });

    await user.type(screen.getByLabelText('Birdəfəlik kod'), '12ab34567');

    expect(screen.getByLabelText('Birdəfəlik kod')).toHaveValue('123456');
  });

  it('keeps only the digits of a pasted code', async () => {
    const { user } = await openApp({ signedIn: false });
    const box = screen.getByLabelText('Birdəfəlik kod');

    await user.click(box);
    await user.paste('12 34-56');

    expect(box).toHaveValue('123456');
  });

  it('sends what the boxes hold even if the page was never told, as when a password manager filled them', async () => {
    const { user, backend } = await openApp({ signedIn: false });
    (screen.getByLabelText('E-poçt') as HTMLInputElement).value = 'admin@example.test';
    (screen.getByLabelText('Şifrə') as HTMLInputElement).value = PASSWORD;
    (screen.getByLabelText('Birdəfəlik kod') as HTMLInputElement).value = CODE;

    await user.click(screen.getByRole('button', { name: 'Daxil ol' }));

    expect(await screen.findByRole('heading', { name: 'İdarəetmə paneli' })).toBeInTheDocument();
    expect(backend.called('POST', '/sessions')[0]?.body).toEqual({
      email: 'admin@example.test',
      password: PASSWORD,
      code: CODE,
    });
  });

  it('says one thing for any wrong answer, and empties the password and the used code', async () => {
    const { user } = await openApp({ signedIn: false });

    await signInThroughForm(user, 'admin', { code: '000000' });

    expect(await screen.findByText('E-poçt, şifrə və ya kod yanlışdır.')).toBeInTheDocument();
    expect(screen.getByLabelText('Birdəfəlik kod')).toHaveValue('');
    expect(screen.getByLabelText('Şifrə')).toHaveValue('');
    expect(screen.getByLabelText('Birdəfəlik kod')).toHaveFocus();
  });

  it('says so when there were too many attempts', async () => {
    const { user, backend } = await openApp({ signedIn: false });
    backend.failNext('POST', '/sessions', 429, {});

    await signInThroughForm(user);

    expect(await screen.findByText(/Çox cəhd edildi/)).toBeInTheDocument();
  });

  it('says so when the server cannot be reached', async () => {
    const { user } = await openApp({ signedIn: false });
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });

    await signInThroughForm(user);

    expect(
      await screen.findByText('İnternet bağlantısını yoxlayın və yenidən cəhd edin.'),
    ).toBeInTheDocument();
  });

  it('signs in with the right answers and sends the CSRF token with everything it changes from then on', async () => {
    const { user, backend } = await openApp({ signedIn: false });

    await signInThroughForm(user);

    expect(await screen.findByRole('heading', { name: 'İdarəetmə paneli' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Şifrə')).not.toBeInTheDocument();
    expect(backend.called('POST', '/sessions')[0]?.headers['x-csrf-token']).toBeUndefined();
    await user.click(navigation().getByRole('button', { name: 'Qeydiyyatlar' }));
    await user.click(await screen.findByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Müraciət detalları' }));
    await user.click(await sheet.findByRole('button', { name: 'Əlaqə saxlanılıb' }));
    await screen.findByText('Status yeniləndi');
    expect(backend.called('PATCH', '/applications/app-1')[0]?.headers['x-csrf-token']).toBe(
      'csrf-token-for-tests',
    );
    expect(backend.called('GET', '/applications/app-1')[0]?.headers['x-csrf-token']).toBeUndefined();
  });

  it('keeps no token, session or text of a family in the browser’s storage or cookies', async () => {
    const { user } = await openApp({ signedIn: false });

    await signInThroughForm(user);
    await screen.findByRole('heading', { name: 'İdarəetmə paneli' });
    await user.click(navigation().getByRole('button', { name: 'Qeydiyyatlar' }));
    await user.click(await screen.findByRole('button', { name: 'Aysel Test' }));
    await screen.findByRole('dialog', { name: 'Müraciət detalları' });

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).toBe('');
  });

  it('starts at the dashboard of a session that is already there, as after a reload', async () => {
    await openApp();

    expect(await screen.findByRole('heading', { name: 'İdarəetmə paneli' })).toBeInTheDocument();
  });

  it('asks to try again later when the server is down at start-up', async () => {
    const backend = new FakeBackend({ signedIn: false });
    backend.failNext('GET', '/sessions/current', 0);
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    setViewportWidth(1440);
    render(<App />);

    expect(await screen.findByText(/Serverlə əlaqə yoxdur/)).toBeInTheDocument();
  });
});

describe('signing out and losing the session', () => {
  it('signs out on the server and says so', async () => {
    const { user, backend } = await openApp();

    await user.click(screen.getByRole('button', { name: 'Çıxış' }));

    expect(await screen.findByRole('heading', { name: 'Sistemdən çıxdınız' })).toBeInTheDocument();
    expect(backend.called('DELETE', '/sessions/current')).toHaveLength(1);
    expect(backend.signedIn).toBe(false);
    expect(screen.queryByRole('navigation', { name: 'Admin menyu' })).not.toBeInTheDocument();
  });

  it('leaves at once when the server says the session is over, and drops what the screen held', async () => {
    const { user, backend } = await openApp({ page: 'cms' });
    const hero = within(await screen.findByRole('region', { name: 'Əsas bölmə' }));
    await user.click(hero.getByRole('button', { name: 'Dərc et' }));
    await screen.findByText('Dəyişiklik yoxdur'); // a message in the corner
    setEdit('hero.title_first', 'Yazılmış, saxlanmamış mətn');
    backend.signedIn = false;

    await user.click(navigation().getByRole('button', { name: 'Kurslar' }));

    expect(await screen.findByRole('heading', { name: 'Sessiya başa çatdı' })).toBeInTheDocument();
    expect(screen.queryByText('Kurslar', { selector: 'h1' })).not.toBeInTheDocument();
    expect(screen.queryByText('Dəyişiklik yoxdur')).not.toBeInTheDocument();
    expect(renderHook(() => useEdits()).result.current).toEqual({}); // the text that was not saved is gone
    expect(screen.getByRole('heading', { name: 'Sessiya başa çatdı' })).toHaveFocus();
  });

  it('drops the unsaved text and the messages when somebody signs out', async () => {
    const { user } = await openApp({ page: 'cms' });
    const hero = within(await screen.findByRole('region', { name: 'Əsas bölmə' }));
    await user.click(hero.getByRole('button', { name: 'Dərc et' }));
    await screen.findByText('Dəyişiklik yoxdur');
    setEdit('hero.title_first', 'Yazılmış, saxlanmamış mətn');

    await user.click(screen.getByRole('button', { name: 'Çıxış' }));

    expect(await screen.findByRole('heading', { name: 'Sistemdən çıxdınız' })).toBeInTheDocument();
    expect(screen.queryByText('Dəyişiklik yoxdur')).not.toBeInTheDocument();
    expect(renderHook(() => useEdits()).result.current).toEqual({});
  });

  it('signs out even if the server cannot be reached', async () => {
    const { user, backend } = await openApp();
    backend.failNext('DELETE', '/sessions/current', 500);

    await user.click(screen.getByRole('button', { name: 'Çıxış' }));

    expect(await screen.findByRole('heading', { name: 'Sistemdən çıxdınız' })).toBeInTheDocument();
  });

  it('keeps the session alive while somebody works, but not more often than every two minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-18T11:30:00Z'));
    const { backend } = await openApp();
    const alive = () => backend.called('GET', '/sessions/current').length;
    const before = alive();

    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(alive()).toBe(before); // just signed in: the session is fresh

    vi.setSystemTime(new Date('2026-10-18T11:33:00Z'));
    act(() => {
      window.dispatchEvent(new Event('keydown'));
      window.dispatchEvent(new Event('pointerdown'));
    });
    await waitFor(() => expect(alive()).toBe(before + 1));
    expect(backend.called('GET', '/sessions/current').at(-1)?.headers['x-background']).toBeUndefined();
  });
});

describe('a screen nobody touches', () => {
  // Only the date and the interval are faked: the rest of the page keeps its real clock.
  const fakeClock = () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-10-18T11:30:00Z'));
  };
  const pass = (minutes: number) =>
    act(() => {
      vi.advanceTimersByTime(minutes * 60_000);
    });
  const touch = (type: 'pointerdown' | 'keydown' | 'click' | 'input') =>
    act(() => {
      window.dispatchEvent(new Event(type));
    });

  it('leaves after the idle time of the session, with what it held, and not before', async () => {
    fakeClock();
    await openApp({ page: 'cms' });
    setEdit('hero.title_first', 'Yazılmış, saxlanmamış mətn');

    pass(14);
    expect(screen.getByRole('navigation', { name: 'Admin menyu' })).toBeInTheDocument();
    pass(2);

    expect(await screen.findByRole('heading', { name: 'Sessiya başa çatdı' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin menyu' })).not.toBeInTheDocument();
    expect(renderHook(() => useEdits()).result.current).toEqual({});
  });

  it('starts the idle time again at every click and every key', async () => {
    fakeClock();
    await openApp();

    pass(14);
    touch('pointerdown');
    pass(14);
    touch('keydown');
    pass(14);

    expect(screen.getByRole('navigation', { name: 'Admin menyu' })).toBeInTheDocument();
    pass(2);
    expect(await screen.findByRole('heading', { name: 'Sessiya başa çatdı' })).toBeInTheDocument();
  });

  it('follows the idle time the API names, and not a longer one', async () => {
    fakeClock();
    await openApp({ idleSeconds: 120 });

    pass(1.9);
    expect(screen.getByRole('navigation', { name: 'Admin menyu' })).toBeInTheDocument();
    pass(0.2);

    expect(await screen.findByRole('heading', { name: 'Sessiya başa çatdı' })).toBeInTheDocument();
  });

  it('uses the longest idle time the API allows when it names none, and does not leave at once', async () => {
    fakeClock();
    await openApp({ idleSeconds: 0 });

    pass(14);
    expect(screen.getByRole('navigation', { name: 'Admin menyu' })).toBeInTheDocument();
    pass(2);

    expect(await screen.findByRole('heading', { name: 'Sessiya başa çatdı' })).toBeInTheDocument();
  });

  it('counts the time a sleeping computer was away, when the tab comes back', async () => {
    fakeClock();
    await openApp();

    act(() => {
      vi.setSystemTime(Date.now() + 3 * 60 * 60_000); // the timers did not run meanwhile
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(await screen.findByRole('heading', { name: 'Sessiya başa çatdı' })).toBeInTheDocument();
  });

  /** What a page asks the API for when it opens, and again when the news changed. */
  const READS = ['POST /applications/search', 'GET /courses?limit=100', 'GET /dashboard?days=30'];
  const readsOf = (backend: Opened['backend']) =>
    backend.requests.filter((request) => READS.includes(`${request.method} ${request.path}`));

  // The pages that left alone for a long time are the dangerous ones: none may keep its session alive by reloading.
  it.each([
    ['reg', 'the registrations', () => screen.findByRole('table')],
    ['dash', 'the dashboard', () => screen.findByRole('region', { name: 'Cavab gözləyənlər' })],
    ['courses', 'the courses', () => screen.findAllByRole('article')],
  ] as const)(
    'does not count the reloads that the news causes on %s (%s) as somebody working',
    async (page, _name, ready) => {
      fakeClock();
      const { backend } = await openApp({ page });
      await ready();
      const atOpening = readsOf(backend).length;
      backend.applications.push(
        makeApplication('fresh', { parent_name: 'Yeni Gələn Ailə', created_at: ago(0) }),
      );

      pass(0.25); // the poll finds news, and the lists reload themselves

      await waitFor(() => expect(readsOf(backend).length).toBeGreaterThan(atOpening));
      const requests = readsOf(backend);
      // What the person asked for when opening the page counts; what the news caused does not.
      expect(requests.slice(0, atOpening).map((r) => r.headers['x-background'])).not.toContain('poll');
      expect(requests.slice(atOpening).map((r) => r.headers['x-background'])).toEqual(
        requests.slice(atOpening).map(() => 'poll'),
      );
    },
  );

  it('does not count the reloads that the news causes while an application is open on the side either', async () => {
    fakeClock();
    const { backend, user } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Müraciət detalları' }));
    await sheet.findByText(/boş yer ·/); // the sheet has its own list of the courses
    const atOpening = readsOf(backend).length;
    backend.applications.push(
      makeApplication('fresh', { parent_name: 'Yeni Gələn Ailə', created_at: ago(0) }),
    );

    pass(0.25);

    await waitFor(() => expect(readsOf(backend).length).toBeGreaterThan(atOpening));
    const caused = readsOf(backend).slice(atOpening);
    expect(caused.filter((r) => r.path === '/courses?limit=100').length).toBeGreaterThan(1); // the page and the sheet
    expect(caused.map((r) => r.headers['x-background'])).toEqual(caused.map(() => 'poll'));
  });

  it('counts a click, a key, or a screen reader’s activation as somebody working', async () => {
    fakeClock();
    await openApp();
    for (const type of ['pointerdown', 'keydown', 'click', 'input'] as const) {
      pass(14);
      touch(type);
    }

    pass(14);

    expect(screen.getByRole('navigation', { name: 'Admin menyu' })).toBeInTheDocument(); // 56 minutes in all
  });
});

describe('a screen that cannot be drawn', () => {
  // React reports the failure it caught; the test keeps that out of the output, and gives it back whatever happens.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function openDrawnBadly() {
    const app = await openApp({ page: 'reg' });
    await screen.findByRole('table'); // families on the screen
    app.backend.failNext('GET', /^\/dashboard/, 200, { totals: null, detail: 'Aysel Test' }); // not the API's shape
    await app.user.click(navigation().getByRole('button', { name: 'İdarəetmə paneli' }));
    return app;
  }

  it('shows one fixed message, with nothing of the failure and nothing of the families', async () => {
    await openDrawnBadly();

    const fallback = await screen.findByRole('alert');
    expect(fallback).toHaveTextContent('Paneli göstərmək mümkün olmadı');
    expect(fallback).not.toHaveTextContent(/Aysel|totals|TypeError|undefined|null/);
    expect(screen.getByRole('main')).toBeInTheDocument(); // the message is inside a page landmark
    expect(screen.queryByRole('navigation', { name: 'Admin menyu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('offers to load the page again', async () => {
    const reload = vi.fn();
    const { location } = window;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...location, reload } });
    try {
      const { user } = await openDrawnBadly();

      await user.click(await screen.findByRole('button', { name: 'Səhifəni yenilə' }));

      expect(reload).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: location });
    }
  });
});

describe('the menu', () => {
  it('shows an admin every page', async () => {
    await openApp();

    expect(
      navigation()
        .getAllByRole('button')
        .map((button) => button.getAttribute('title')),
    ).toEqual(['İdarəetmə paneli', 'Qeydiyyatlar', 'Kurslar', 'Saytın idarə edilməsi', 'İstifadəçilər']);
  });

  it.each(['coordinator', 'viewer'] as const)(
    'shows a %s the pages they may open and no more',
    async (role) => {
      await openApp({ role });

      expect(
        navigation()
          .getAllByRole('button')
          .map((button) => button.getAttribute('title')),
      ).toEqual(['İdarəetmə paneli', 'Qeydiyyatlar', 'Kurslar']);
    },
  );

  it('opens the dashboard for a page the role may not open, even if the address names it', async () => {
    await openApp({ role: 'viewer', page: 'cms' });

    expect(await screen.findByRole('heading', { name: 'İdarəetmə paneli' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Saytın idarə edilməsi' })).not.toBeInTheDocument();
  });

  it('changes the page and keeps it in the address, with nothing but its name', async () => {
    const { user } = await openApp();

    await user.click(navigation().getByRole('button', { name: 'Kurslar' }));

    expect(await screen.findByRole('heading', { name: 'Kurslar' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#courses');
    expect(navigation().getByRole('button', { name: 'Kurslar' })).toHaveAttribute('aria-current', 'page');
  });

  it('names the page in the title and moves the focus to the page, as a page load does', async () => {
    const { user } = await openApp();
    expect(document.title).toBe('İdarəetmə paneli · KidsUp Admin');
    expect(document.getElementById('main')).not.toHaveFocus(); // the first page does not take the focus

    await user.click(navigation().getByRole('button', { name: 'Kurslar' }));

    await screen.findByRole('heading', { name: 'Kurslar' });
    expect(document.title).toBe('Kurslar · KidsUp Admin');
    expect(document.getElementById('main')).toHaveFocus();
  });

  it('titles the sign-in page, and never puts a family in a title', async () => {
    const { user } = await openApp({ signedIn: false });
    expect(document.title).toBe('Daxil ol · KidsUp Admin');

    await signInThroughForm(user);
    await screen.findByRole('heading', { name: 'İdarəetmə paneli' });
    await user.click(navigation().getByRole('button', { name: /^Qeydiyyatlar/ }));
    await user.click(await screen.findByRole('button', { name: 'Aysel Test' }));
    await screen.findByRole('dialog', { name: 'Müraciət detalları' });

    expect(document.title).toBe('Qeydiyyatlar · KidsUp Admin'); // opening an application changes nothing
  });

  it('opens the page the address names', async () => {
    await openApp({ page: 'users' });

    expect(await screen.findByRole('heading', { name: 'İstifadəçilər' })).toBeInTheDocument();
  });

  it('follows the back button', async () => {
    const { user } = await openApp();
    await user.click(navigation().getByRole('button', { name: 'Kurslar' }));
    await screen.findByRole('heading', { name: 'Kurslar' });

    act(() => {
      window.location.hash = 'dash';
    });

    expect(await screen.findByRole('heading', { name: 'İdarəetmə paneli' })).toBeInTheDocument();
  });

  it('counts the new applications on the Registrations button', async () => {
    await openApp();

    await waitFor(() =>
      expect(navigation().getByRole('button', { name: 'Qeydiyyatlar, 2 yeni müraciət' })).toBeInTheDocument(),
    );
  });

  it('shows the name and the role of whoever is signed in', async () => {
    await openApp();

    expect(screen.getByText('Test Admin')).toBeInTheDocument();
    expect(screen.getByText('admin@example.test')).toBeInTheDocument();
    const profile = screen.getByText('Test Admin').parentElement as HTMLElement;
    expect(within(profile).getByText('Admin')).toBeInTheDocument(); // the role, so staff know what they may do
  });

  it('lets a keyboard user skip to the page', async () => {
    const { user } = await openApp();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Əsas məzmuna keç' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(document.getElementById('main')).toHaveFocus();
  });
});

describe('on a narrow screen', () => {
  it('keeps the menu behind a button and closes it with Escape', async () => {
    const { user } = await openApp({ width: 390 });
    const sidebar = screen.getByRole('complementary', { name: 'Yan panel' });

    expect(sidebar).toHaveAttribute('inert'); // out of reach of the keyboard and of screen readers while shut
    await user.click(screen.getByRole('button', { name: 'Menyunu aç' }));
    expect(sidebar).not.toHaveAttribute('inert');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(sidebar).toHaveAttribute('inert'));
  });

  it('goes to a page from the menu and shuts the menu', async () => {
    const { user } = await openApp({ width: 390 });
    const sidebar = screen.getByRole('complementary', { name: 'Yan panel' });

    await user.click(screen.getByRole('button', { name: 'Menyunu aç' }));
    await user.click(within(sidebar).getByRole('button', { name: 'Kurslar' }));

    expect(await screen.findByRole('heading', { name: 'Kurslar' })).toBeInTheDocument();
    expect(sidebar).toHaveAttribute('inert');
  });
  it('shows only icons in the rail between 760 and 1100 pixels', async () => {
    await openApp({ width: 900 });

    expect(navigation().queryByText('Qeydiyyatlar')).not.toBeInTheDocument();
    expect(navigation().getByRole('button', { name: /Qeydiyyatlar/ })).toBeInTheDocument();
  });
});

describe('the sign-in on a user that types fast', () => {
  it('does not need a mouse', async () => {
    const backend = new FakeBackend({ signedIn: false });
    vi.stubGlobal('fetch', backend.fetch);
    setViewportWidth(1440);
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await screen.findByRole('button', { name: 'Daxil ol' });

    await user.click(screen.getByLabelText('E-poçt'));
    await user.keyboard('admin@example.test{Tab}correct horse battery staple{Tab}123456{Enter}');

    expect(await screen.findByRole('heading', { name: 'İdarəetmə paneli' })).toBeInTheDocument();
  });
});
