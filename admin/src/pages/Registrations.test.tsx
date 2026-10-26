import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openApp } from '../test/app.tsx';
import type { Opened } from '../test/app.tsx';
import { applicationsOf, makeApplication, makeCourse } from '../test/fixtures.ts';

const tableRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const parentsListed = () => tableRows().map((row) => within(row).getAllByRole('button')[0]?.textContent);

async function open(options: Parameters<typeof openApp>[0] = {}): Promise<Opened> {
  const app = await openApp({ page: 'reg', ...options });
  await screen.findByRole('heading', { name: 'Qeydiyyatlar' });
  await screen.findByRole('table');
  return app;
}

const drawer = () => screen.findByRole('dialog', { name: 'Müraciət detalları' });

/** How visible an element is, with the dimming of everything around it. */
function effectiveOpacity(element: Element | null): number {
  let opacity = 1;
  for (let node = element; node; node = node.parentElement) {
    opacity *= Number(getComputedStyle(node).opacity || 1);
  }
  return opacity;
}

describe('the list', () => {
  it('shows every application of the stored data, the newest first', async () => {
    await open();

    expect(parentsListed()).toEqual([
      'Aysel Test',
      'Leyla Nümunə',
      'Günel Sınaq',
      'Nigar Fake',
      'Fidan Demo',
    ]);
    const first = within(tableRows()[0]!);
    expect(first.getByRole('link', { name: '+994 50 123 45 67' })).toHaveAttribute(
      'href',
      'tel:+994501234567',
    );
    expect(first.getByText('Murad Test')).toBeInTheDocument();
    expect(first.getByText('10')).toBeInTheDocument();
    expect(first.getByText('18 okt 2026')).toBeInTheDocument();
    expect(first.getByText('Yeni')).toBeInTheDocument();
    expect(screen.getByText('5 müraciət')).toBeInTheDocument();
  });

  it('counts each status on its chip, from the courses', async () => {
    await open();

    const filter = within(screen.getByRole('group', { name: 'Status filtri' }));
    expect(filter.getByRole('button', { name: /^Hamısı\s*5$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(filter.getByRole('button', { name: /^Yeni\s*2$/ })).toBeInTheDocument();
    expect(filter.getByRole('button', { name: /^Əlaqə saxlanılıb\s*1$/ })).toBeInTheDocument();
    expect(filter.getByRole('button', { name: /^Təsdiqlənib\s*1$/ })).toBeInTheDocument();
    expect(filter.getByRole('button', { name: /^İmtina edilib\s*1$/ })).toBeInTheDocument();
  });

  it('filters by status on the server', async () => {
    const { user, backend } = await open();

    await user.click(screen.getByRole('button', { name: /^Yeni\s*2$/ }));

    await waitFor(() => expect(parentsListed()).toEqual(['Aysel Test', 'Leyla Nümunə']));
    expect(backend.called('POST', '/applications/search').at(-1)?.body).toMatchObject({ statuses: ['new'] });
    expect(screen.getByText('5 müraciətdən 2 tapıldı')).toBeInTheDocument();
  });

  it('searches by a child, a parent or a phone number, after typing stops, and never in the address', async () => {
    const { user, backend } = await open();
    const box = screen.getByRole('searchbox', { name: 'Axtarış' });
    expect(box).toHaveAttribute('spellcheck', 'false'); // what is typed here is a family's name: no dictionary

    await user.type(box, 'ayan');
    await waitFor(() => expect(parentsListed()).toEqual(['Leyla Nümunə']));
    expect(backend.called('POST', '/applications/search').at(-1)?.body).toMatchObject({ search: 'ayan' });

    await user.clear(box);
    await user.type(box, 'GÜNEL');
    await waitFor(() => expect(parentsListed()).toEqual(['Günel Sınaq']));

    await user.clear(box);
    await user.type(box, '994 50 123');
    await waitFor(() => expect(parentsListed()).toHaveLength(5)); // the same number on every test family

    // A name or a number typed into the search never reaches an address or the visible page address.
    expect(backend.requests.every((request) => !/ayan|g%C3%BCnel|994/i.test(request.path))).toBe(true);
    expect(window.location.href).not.toMatch(/ayan|günel|994/i);
  });

  it('does not ask the server for every key typed', async () => {
    const { user, backend } = await open();
    const before = backend.called('POST', '/applications/search').length;

    await user.type(screen.getByRole('searchbox', { name: 'Axtarış' }), 'leyla');
    await waitFor(() => expect(parentsListed()).toEqual(['Leyla Nümunə']));

    expect(backend.called('POST', '/applications/search').length - before).toBeLessThanOrEqual(2);
  });

  it('clears the search with its button and says so when nothing is found', async () => {
    const { user } = await open();
    const box = screen.getByRole('searchbox', { name: 'Axtarış' });

    await user.type(box, 'zzzz');
    expect(await screen.findByText('Müraciət tapılmadı')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filtrləri sıfırla' }));
    await waitFor(() => expect(parentsListed()).toHaveLength(5));
    expect(box).toHaveValue('');

    await user.type(box, 'a');
    await user.click(screen.getByRole('button', { name: 'Axtarışı təmizlə' }));
    expect(box).toHaveValue('');
  });

  it('is calm when no application has come yet', async () => {
    await openApp({ page: 'reg', applications: [] });

    expect(await screen.findByText('Hələ müraciət yoxdur')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filtrləri sıfırla' })).not.toBeInTheDocument();
  });

  it('filters by course when there is more than one', async () => {
    const { user, backend } = await open({
      courses: [
        makeCourse(),
        makeCourse({ id: 'course-2', title: '16 yanvar – 21 fevral 2027', registration_open: false }),
      ],
      applications: [
        ...applicationsOf(['new', 'approved']),
        makeApplication(
          'other',
          { parent_name: 'Başqa Qrup', status: 'new' },
          'course-2',
          '16 yanvar – 21 fevral 2027',
        ),
      ],
    });
    expect(parentsListed()).toHaveLength(3);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Kurs' }), 'course-2');

    await waitFor(() => expect(parentsListed()).toEqual(['Başqa Qrup']));
    expect(backend.called('POST', '/applications/search').at(-1)?.body).toMatchObject({
      course_id: 'course-2',
    });
    expect(screen.getByRole('button', { name: /^Yeni\s*1$/ })).toBeInTheDocument(); // counted over that course only
  });

  it('has no course choice when there is one course', async () => {
    await open();

    expect(screen.queryByRole('combobox', { name: 'Kurs' })).not.toBeInTheDocument();
  });

  it('loads the next page on request', async () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      makeApplication(`many-${index}`, {
        parent_name: `Ailə ${index}`,
        created_at: new Date(Date.UTC(2026, 9, 1, 0, index)).toISOString(),
      }),
    );
    const { user } = await open({ applications: many });

    expect(parentsListed()).toHaveLength(25);
    expect(screen.getByText('30 müraciət · 25 göstərilir')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Daha çox göstər' }));

    await waitFor(() => expect(parentsListed()).toHaveLength(30));
    expect(screen.queryByRole('button', { name: 'Daha çox göstər' })).not.toBeInTheDocument();
  });

  it('says so when the next page cannot be loaded', async () => {
    const many = Array.from({ length: 30 }, (_, index) => makeApplication(`many-${index}`));
    const { user, backend } = await open({ applications: many });
    backend.failNext('POST', '/applications/search', 500);

    await user.click(screen.getByRole('button', { name: 'Daha çox göstər' }));

    expect(await screen.findByText('Server xətası')).toBeInTheDocument();
    expect(parentsListed()).toHaveLength(25);
  });

  it('offers to try again when the list cannot be loaded', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: /^Yeni\s*2$/ }));
    backend.failNext('POST', '/applications/search', 500);
    await user.click(screen.getByRole('button', { name: /^Hamısı\s*5$/ }));

    await user.click(await screen.findByRole('button', { name: 'Yenidən cəhd et' }));

    await waitFor(() => expect(parentsListed()).toHaveLength(5));
  });

  it('shows cards instead of a table on a narrow screen', async () => {
    const { user } = await openApp({ page: 'reg', width: 600 });
    await screen.findByRole('heading', { name: 'Qeydiyyatlar' });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = (await screen.findByText('Aysel Test')).closest('li') as HTMLElement;
    expect(within(card).getByText('Murad Test · 10 yaş')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '+994 50 123 45 67' })).toBeInTheDocument();

    await user.click(within(card).getByRole('button'));
    expect(await drawer()).toBeInTheDocument();
  });
});

describe('the export', () => {
  afterEach(() => vi.restoreAllMocks());

  const exportDialog = () => screen.findByRole('alertdialog', { name: 'CSV faylı yüklənsin?' });

  /** Press the export button, then confirm the question it asks. */
  async function exportConfirmed(user: Opened['user']) {
    await user.click(screen.getByRole('button', { name: 'CSV yüklə' }));
    await user.click(within(await exportDialog()).getByRole('button', { name: 'CSV yüklə' }));
  }

  it('is for an admin only', async () => {
    await open({ role: 'coordinator' });

    expect(screen.queryByRole('button', { name: 'CSV yüklə' })).not.toBeInTheDocument();
  });

  it('asks first, says what the file holds and that it is logged, and sends nothing until confirmed', async () => {
    const { user, backend } = await open();

    await user.click(screen.getByRole('button', { name: 'CSV yüklə' }));

    const dialog = within(await exportDialog());
    expect(dialog.getByText(/5 müraciətin məlumatları/)).toBeInTheDocument();
    expect(dialog.getByText(/jurnalda qeyd olunur/)).toBeInTheDocument();
    expect(await exportDialog()).toHaveAccessibleDescription(/jurnalda qeyd olunur/); // read after its name
    expect(backend.called('POST', '/applications/export')).toHaveLength(0);

    await user.click(dialog.getByRole('button', { name: 'Ləğv et' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(backend.called('POST', '/applications/export')).toHaveLength(0);
  });

  it('downloads what the filter shows, asking in a body', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: /^Yeni\s*2$/ }));
    await waitFor(() => expect(parentsListed()).toHaveLength(2));

    await exportConfirmed(user);

    expect(await screen.findByText('CSV yükləndi')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(backend.called('POST', '/applications/export')[0]?.body).toEqual({
      search: null,
      statuses: ['new'],
      course_id: null,
    });
    expect(click).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(await created[0]!.text()).toContain('app-1;new');
  });

  it('says so when the file cannot be made', async () => {
    const { user, backend } = await open();
    backend.failNext('POST', '/applications/export', 413, { code: 'too_many_rows' });

    await exportConfirmed(user);

    expect(await screen.findByText('İxrac üçün çox sətir var')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

describe('the details of an application', () => {
  it('opens from a row and shows the family, the course and the consent', async () => {
    const { user, backend } = await open();

    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));

    const sheet = within(await drawer());
    expect(await sheet.findByRole('heading', { name: 'Aysel Test' })).toBeInTheDocument();
    expect(sheet.getByText('+994 50 123 45 67')).toBeInTheDocument();
    expect(sheet.getByText('Azərbaycan')).toBeInTheDocument();
    expect(sheet.getByText('Murad Test')).toBeInTheDocument();
    expect(sheet.getByText('10 yaş')).toBeInTheDocument();
    expect(sheet.getByText('14 mar 2016')).toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'Zəng et' })).toHaveAttribute('href', 'tel:+994501234567');
    expect(await sheet.findByText('19 boş yer · 1/20')).toBeInTheDocument();
    expect(sheet.getByText('Şənbə, 09:30–13:00 · 650 AZN')).toBeInTheDocument();
    expect(sheet.getByText(/Valideyn razılığı: 18 okt 2026, .* bildiriş 2026-10-19/)).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Yeni', pressed: true })).toBeInTheDocument();
    expect(backend.called('GET', '/applications/app-1')).toHaveLength(1);
  });

  it('warns when a child is outside the age range, and says so for an old application without consent', async () => {
    const odd = makeApplication('odd', {
      parent_name: 'Yaş Fərqi',
      children: [
        { name: 'Böyük Uşaq', birth_date: '2008-01-01', age_at_course_start: 18, within_age_range: false },
      ],
      consent_given_at: null,
      privacy_notice_version: null,
    });
    const { user } = await open({ applications: [odd] });

    await user.click(screen.getByRole('button', { name: 'Yaş Fərqi' }));

    const sheet = within(await drawer());
    expect(await sheet.findByText('Kursun yaş həddindən kənardır')).toBeInTheDocument();
    expect(sheet.getByText(/Razılıq qeydi yoxdur/)).toBeInTheDocument();
  });

  it('shows both children of a family', async () => {
    const two = makeApplication('two', {
      parent_name: 'İki Uşaqlı',
      children: [
        { name: 'Birinci Uşaq', birth_date: '2016-03-14', age_at_course_start: 10, within_age_range: true },
        { name: 'İkinci Uşaq', birth_date: '2018-05-01', age_at_course_start: 8, within_age_range: true },
      ],
    });
    const { user } = await open({ applications: [two] });

    await user.click(screen.getByRole('button', { name: 'İki Uşaqlı' }));

    const sheet = within(await drawer());
    expect(await sheet.findByRole('heading', { name: 'Uşaqlar' })).toBeInTheDocument();
    expect(sheet.getByText('Birinci Uşaq')).toBeInTheDocument();
    expect(sheet.getByText('İkinci Uşaq')).toBeInTheDocument();
  });

  it('closes with Escape and takes the details out of the page', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    await within(await drawer()).findByRole('heading', { name: 'Aysel Test' });

    await user.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Aysel Test', level: 2 })).not.toBeInTheDocument(),
    );
  });

  it('closes with its button and by a click outside', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    await within(await drawer()).findByRole('heading', { name: 'Aysel Test' });

    await user.click(within(await drawer()).getByRole('button', { name: 'Bağla' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Aysel Test', level: 2 })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Leyla Nümunə' }));
    await within(await drawer()).findByRole('heading', { name: 'Leyla Nümunə' });
    await user.click(screen.getByTestId('drawer-scrim')); // the dimmed page beside the sheet
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Leyla Nümunə', level: 2 })).not.toBeInTheDocument(),
    );
  });

  it('says so when the application cannot be loaded, and loads it on a second try', async () => {
    const { user, backend } = await open();
    backend.failNext('GET', '/applications/app-1', 500);

    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    await user.click(await within(await drawer()).findByRole('button', { name: 'Yenidən cəhd et' }));

    expect(await within(await drawer()).findByRole('heading', { name: 'Aysel Test' })).toBeInTheDocument();
  });

  it('shows the application another member of staff deleted as gone', async () => {
    const { user, backend } = await open();
    backend.failNext('GET', '/applications/app-1', 404, { code: 'application_not_found' });

    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));

    expect(await within(await drawer()).findByText('Müraciət tapılmadı')).toBeInTheDocument();
  });
});

describe('changing the status', () => {
  it('moves an application on, writes it to the server, and updates the list', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());

    await user.click(await sheet.findByRole('button', { name: 'Əlaqə saxlanılıb' }));

    const message = (await screen.findByText('Status yeniləndi')).closest('[role="status"]');
    expect(message).toHaveTextContent('Əlaqə saxlanılıb');
    expect(message).not.toHaveTextContent('Aysel'); // a message stays on the screen: it never names a family
    expect(backend.called('PATCH', '/applications/app-1')[0]?.body).toEqual({ status: 'contacted' });
    expect(backend.called('PATCH', '/applications/app-1')[0]?.headers['x-csrf-token']).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Əlaqə saxlanılıb', pressed: true })).toBeInTheDocument();
    await waitFor(() => expect(within(tableRows()[0]!).getByText('Əlaqə saxlanılıb')).toBeInTheDocument());
    expect(backend.called('GET', '/applications/app-1')).toHaveLength(1); // not read again: it was not asked to be
  });

  it('approves, takes a seat, and says how many are left', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());

    await user.click(await sheet.findByRole('button', { name: 'Təsdiqlənib' }));

    const message = (await screen.findByText('Qeydiyyat təsdiqləndi')).closest('[role="status"]');
    expect(message).toHaveTextContent(/1 uşaq kursa əlavə olundu\. .*: 18 boş yer qaldı\./);
    expect(message).not.toHaveTextContent('Murad'); // the child's name stays out of the message
    expect(backend.course().seats.free_seats).toBe(18);
    expect(await sheet.findByText('18 boş yer · 2/20')).toBeInTheDocument();
  });

  it('does not call a change a failure when only the read of the seats after it fails', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());
    await sheet.findByText(/boş yer ·/); // the course is loaded
    backend.failNext('GET', '/courses?limit=100', 500);

    await user.click(await sheet.findByRole('button', { name: 'Təsdiqlənib' }));

    const message = (await screen.findByText('Qeydiyyat təsdiqləndi')).closest('[role="status"]');
    expect(message).toHaveTextContent('1 uşaq kursa əlavə olundu.');
    expect(message).not.toHaveTextContent('boş yer qaldı'); // it could not tell how many seats are left
    expect(backend.application('app-1').status).toBe('approved');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('says that an approval was taken back and a seat freed', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Nigar Fake' }));
    const sheet = within(await drawer());

    await user.click(await sheet.findByRole('button', { name: 'İmtina edilib' }));

    expect(await screen.findByText('Status: İmtina edilib')).toBeInTheDocument();
    expect(screen.getByText('Təsdiq ləğv olundu, kursda 1 yer boşaldı.')).toBeInTheDocument();
  });

  it('does not ask the server to approve into a full course, and says why', async () => {
    const { user, backend } = await open({ courses: [makeCourse({ capacity: 1 })] });
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());

    const approve = await sheet.findByRole('button', { name: /Təsdiqlənib/ });
    expect(approve).toHaveAttribute('aria-disabled', 'true');
    const reason = sheet.getByText('Kursda boş yer yoxdur');
    expect(effectiveOpacity(reason)).toBe(1); // the button looks unavailable, the reason stays readable
    expect(effectiveOpacity(within(approve).getByText('Təsdiqlənib'))).toBeLessThan(1);
    await user.click(approve);

    expect(await screen.findByText('Təsdiq mümkün deyil')).toBeInTheDocument();
    expect(backend.called('PATCH', '/applications/app-1')).toHaveLength(0);
  });

  it('counts the seats a family needs: two children need two seats', async () => {
    const two = makeApplication('two', {
      parent_name: 'İki Uşaqlı',
      children: [
        { name: 'Birinci Uşaq', birth_date: '2016-03-14', age_at_course_start: 10, within_age_range: true },
        { name: 'İkinci Uşaq', birth_date: '2018-05-01', age_at_course_start: 8, within_age_range: true },
      ],
    });
    const { user, backend } = await open({ applications: [two], courses: [makeCourse({ capacity: 1 })] });
    await user.click(screen.getByRole('button', { name: 'İki Uşaqlı' }));
    const sheet = within(await drawer());

    expect(await sheet.findByText('Kursda yer çatmır')).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: /Təsdiqlənib/ }));

    expect(screen.getByText(/lazım: 2, boş: 1/)).toBeInTheDocument();
    expect(backend.called('PATCH', '/applications/two')).toHaveLength(0);
  });

  it('explains a refusal of the server when someone else took the last seat meanwhile', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());
    await sheet.findByRole('button', { name: 'Təsdiqlənib' });
    backend.failNext('PATCH', '/applications/app-1', 409, {
      code: 'not_enough_seats',
      needed: 1,
      free_seats: 0,
    });

    await user.click(sheet.getByRole('button', { name: 'Təsdiqlənib' }));

    expect(
      await screen.findByText('Kursda kifayət qədər boş yer yoxdur (lazım: 1, boş: 0).'),
    ).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Yeni', pressed: true })).toBeInTheDocument();
  });

  it('lets a coordinator move an application on, but not take an approval back', async () => {
    const { user, backend } = await open({ role: 'coordinator' });
    await user.click(screen.getByRole('button', { name: 'Nigar Fake' }));
    const sheet = within(await drawer());

    await sheet.findByRole('button', { name: 'Təsdiqlənib', pressed: true });
    expect(sheet.getByRole('button', { name: 'İmtina edilib' })).toBeDisabled();
    expect(
      sheet.getByText('Təsdiqlənmiş müraciətin statusunu yalnız admin dəyişə bilər.'),
    ).toBeInTheDocument();
    expect(backend.called('PATCH', /applications/)).toHaveLength(0);
  });

  it('shows what the server says if a coordinator got round the page', async () => {
    const { user, backend } = await open({ role: 'coordinator' });
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());
    await sheet.findByRole('button', { name: 'Təsdiqlənib' });
    backend.failNext('PATCH', '/applications/app-1', 403, { code: 'approval_locked' });

    await user.click(sheet.getByRole('button', { name: 'Əlaqə saxlanılıb' }));

    expect(await screen.findByText('Təsdiqi geri götürmək olmur')).toBeInTheDocument();
  });

  it('lets a viewer look and nothing else', async () => {
    const { user } = await open({ role: 'viewer' });
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());

    await sheet.findByRole('heading', { name: 'Aysel Test' });
    for (const name of ['Yeni', 'Əlaqə saxlanılıb', 'Təsdiqlənib', 'İmtina edilib']) {
      expect(sheet.getByRole('button', { name })).toBeDisabled();
    }
    expect(sheet.getByText('Rolunuz yalnız baxış üçündür: statusu dəyişmək olmur.')).toBeInTheDocument();
    expect(sheet.queryByLabelText('Yeni daxili qeyd')).not.toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Müraciəti sil' })).not.toBeInTheDocument();
  });
});

describe('notes', () => {
  it('saves a note that staff can see, with its author', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());
    const save = await sheet.findByRole('button', { name: 'Qeydi saxla' });
    expect(save).toBeDisabled();

    await user.type(sheet.getByLabelText('Yeni daxili qeyd'), 'Cümə günü yenidən zəng ediləcək.');
    await user.click(save);

    const message = (await screen.findByText('Qeyd yadda saxlanıldı')).closest('[role="status"]');
    expect(message).not.toHaveTextContent('Aysel'); // a message stays on the screen: it never names a family
    expect(sheet.getByLabelText('Yeni daxili qeyd')).toHaveAttribute('spellcheck', 'false');
    expect(backend.called('POST', '/applications/app-1/notes')[0]?.body).toEqual({
      body: 'Cümə günü yenidən zəng ediləcək.',
    });
    expect(sheet.getByText('Cümə günü yenidən zəng ediləcək.')).toBeInTheDocument();
    expect(sheet.getByText(/Test Admin · 18 okt 2026/)).toBeInTheDocument();
    expect(sheet.getByLabelText('Yeni daxili qeyd')).toHaveValue('');
    expect(save).toBeDisabled();
  });

  it('lets an admin take a note back, and nobody else', async () => {
    const withNote = makeApplication('noted', {
      parent_name: 'Qeydli Ailə',
      notes: [{ id: 'n1', body: 'Köhnə qeyd', created_at: '2026-10-17T10:00:00Z', author: null }],
    });
    const first = await open({ applications: [withNote] });
    await first.user.click(screen.getByRole('button', { name: 'Qeydli Ailə' }));
    const sheet = within(await drawer());
    expect(await sheet.findByText(/Silinmiş hesab/)).toBeInTheDocument();

    await first.user.click(sheet.getByRole('button', { name: 'Qeydi sil' }));

    const message = (await screen.findByText('Qeyd silindi')).closest('[role="status"]');
    expect(message).not.toHaveTextContent('Qeydli'); // never the family
    expect(sheet.queryByText('Köhnə qeyd')).not.toBeInTheDocument();
    expect(first.backend.called('DELETE', '/applications/noted/notes/n1')).toHaveLength(1);
  });

  it('does not offer the bin to a coordinator', async () => {
    const withNote = makeApplication('noted', {
      parent_name: 'Qeydli Ailə',
      notes: [{ id: 'n1', body: 'Köhnə qeyd', created_at: '2026-10-17T10:00:00Z', author: 'Biri' }],
    });
    const { user } = await open({ role: 'coordinator', applications: [withNote] });

    await user.click(screen.getByRole('button', { name: 'Qeydli Ailə' }));

    const sheet = within(await drawer());
    expect(await sheet.findByText('Köhnə qeyd')).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Qeydi sil' })).not.toBeInTheDocument();
  });

  it('says why a note was not saved', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await drawer());
    await user.type(await sheet.findByLabelText('Yeni daxili qeyd'), 'Bir qeyd');
    backend.failNext('POST', '/applications/app-1/notes', 409, { code: 'too_many_notes', maximum: 200 });

    await user.click(sheet.getByRole('button', { name: 'Qeydi saxla' }));

    expect(await screen.findByText('Qeydlərin sayı limitə çatıb')).toBeInTheDocument();
    expect(sheet.getByLabelText('Yeni daxili qeyd')).toHaveValue('Bir qeyd'); // what was typed is kept
  });
});

describe('erasing an application', () => {
  it('asks first, then deletes the family, and the list and the seats follow', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Nigar Fake' }));
    const sheet = within(await drawer());

    await user.click(await sheet.findByRole('button', { name: 'Müraciəti sil' }));
    const confirmation = within(await screen.findByRole('alertdialog', { name: 'Müraciət silinsin?' }));
    expect(
      confirmation.getByText(/Nigar Fake \(Nərgiz Fake\) müraciəti birdəfəlik silinəcək/),
    ).toBeInTheDocument();
    expect(backend.called('DELETE', /applications/)).toHaveLength(0);
    await user.click(confirmation.getByRole('button', { name: 'Bəli, sil' }));

    const message = (await screen.findByText('Müraciət silindi')).closest('[role="status"]');
    expect(message).toHaveTextContent('Kursda yerlər boşaldı.'); // she was approved: the seats are free again
    expect(message).not.toHaveTextContent(/Nigar|Nərgiz/); // never the family
    expect(backend.called('DELETE', '/applications/app-4?confirm=true')).toHaveLength(1);
    await waitFor(() => expect(parentsListed()).not.toContain('Nigar Fake'));
    expect(backend.course().seats.free_seats).toBe(20);
  });

  it('keeps everything when the question is answered no', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Nigar Fake' }));
    await user.click(await within(await drawer()).findByRole('button', { name: 'Müraciəti sil' }));

    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Ləğv et' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(backend.called('DELETE', /applications/)).toHaveLength(0);
    expect(parentsListed()).toContain('Nigar Fake');
  });

  it('closes the question with Escape before it closes the sheet', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Nigar Fake' }));
    await user.click(await within(await drawer()).findByRole('button', { name: 'Müraciəti sil' }));
    await screen.findByRole('alertdialog');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(within(await drawer()).getByRole('heading', { name: 'Nigar Fake' })).toBeInTheDocument();
  });

  it('is for an admin only', async () => {
    const { user } = await open({ role: 'coordinator' });
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));

    await within(await drawer()).findByRole('heading', { name: 'Aysel Test' });

    expect(screen.queryByRole('button', { name: 'Müraciəti sil' })).not.toBeInTheDocument();
  });

  it('says so when the erasure fails, and keeps the application', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Nigar Fake' }));
    await user.click(await within(await drawer()).findByRole('button', { name: 'Müraciəti sil' }));
    backend.failNext('DELETE', /applications\/app-4/, 500);

    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Bəli, sil' }),
    );

    expect(await screen.findByText('Server xətası')).toBeInTheDocument();
    expect(parentsListed()).toContain('Nigar Fake');
  });
});

describe('coming from another page', () => {
  it('opens an application asked for by the course window', async () => {
    const { user } = await openApp({ page: 'courses' });
    await user.click(await screen.findByRole('button', { name: /İştirakçılar/ }));
    const people = within(await screen.findByRole('dialog', { name: 'İştirakçılar' }));

    await user.click(await people.findByRole('button', { name: /Nərgiz Fake/ }));

    expect(await within(await drawer()).findByRole('heading', { name: 'Nigar Fake' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Qeydiyyatlar' })).toBeInTheDocument();
  });
});
