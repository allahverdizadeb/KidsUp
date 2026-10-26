import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from '../test/app.tsx';
import { applicationsOf, makeCourse } from '../test/fixtures.ts';

/** The four figures are buttons; each is told apart by the line under its number. */
const KPI = {
  all: /Ümumi müraciətlər/,
  new: /Baxılmağı gözləyir/,
  contacted: /Qərar mərhələsində/,
  approved: /Bütün kurslar üzrə/,
};
const kpi = (which: keyof typeof KPI) => screen.getByRole('button', { name: KPI[which] });

describe('the dashboard', () => {
  it('says what waits, and which course the form is tied to', async () => {
    await openApp();

    expect(
      await screen.findByRole('heading', { name: '2 yeni müraciət cavab gözləyir' }),
    ).toBeInTheDocument();
    expect(screen.getByText('18 oktyabr 2026, bazar')).toBeInTheDocument();
    expect(
      screen.getByText(/qeydiyyat formu “5 dekabr 2026 – 10 yanvar 2027” kursuna bağlıdır/),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '1 təsdiqlənib, 20 yerdən' })).toBeInTheDocument();
    expect(screen.getByText('19 boş yer')).toBeInTheDocument();
  });

  it('shows the four figures with the shares computed from the stored applications', async () => {
    await openApp();
    await screen.findByRole('heading', { name: /yeni müraciət/ });

    expect(within(kpi('all')).getByText('5')).toBeInTheDocument();
    expect(within(kpi('new')).getByText('2')).toBeInTheDocument();
    expect(within(kpi('new')).getByText('40%')).toBeInTheDocument();
    expect(within(kpi('contacted')).getByText('20%')).toBeInTheDocument();
    expect(within(kpi('approved')).getByText('20% konversiya')).toBeInTheDocument();
  });

  it('opens the registrations of a status from its figure', async () => {
    const { user } = await openApp();
    await screen.findByRole('heading', { name: /yeni müraciət/ });

    await user.click(kpi('new'));

    expect(await screen.findByRole('heading', { name: 'Qeydiyyatlar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Yeni/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hamısı/, pressed: false })).toBeInTheDocument();
  });

  it('opens the new applications from the dark card, and the courses', async () => {
    const { user } = await openApp();
    await screen.findByRole('heading', { name: /yeni müraciət/ });

    await user.click(screen.getByRole('button', { name: /Yeni müraciətlər/ }));
    expect(await screen.findByRole('heading', { name: 'Qeydiyyatlar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'İdarəetmə paneli' }));
    await screen.findByRole('heading', { name: /yeni müraciət/ });
    await user.click(screen.getByRole('button', { name: 'Kursları idarə et' }));
    expect(await screen.findByRole('heading', { name: 'Kurslar' })).toBeInTheDocument();
  });

  it('lists the families that waited longest first, with a way to call them', async () => {
    await openApp();
    const card = await screen.findByRole('region', { name: 'Cavab gözləyənlər' });

    const rows = within(card).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('Leyla Nümunə')).toBeInTheDocument(); // sent 29 hours ago
    expect(within(rows[0]!).getByText('1 gündür gözləyir')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Aysel Test')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Bu gün gəlib')).toBeInTheDocument();
    expect(within(rows[0]!).getByRole('link', { name: 'Zəng et: Leyla Nümunə' })).toHaveAttribute(
      'href',
      'tel:+994501234567',
    );
  });

  it('does not say that every new application was looked at while the list is still on its way', async () => {
    const { backend } = await openApp({ page: 'courses' });
    await screen.findByRole('heading', { name: 'Kurslar' });
    vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).endsWith('/applications/search')
        ? new Promise<Response>(() => undefined)
        : backend.fetch(input, init),
    );

    fireEvent.click(screen.getByRole('button', { name: 'İdarəetmə paneli' }));

    expect(await screen.findByRole('heading', { name: 'Cavab gözləyənlər' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Yüklənir…');
    expect(screen.queryByText('Bütün yeni müraciətlərə baxılıb.')).not.toBeInTheDocument();
  });

  it('says so when the list of those who wait could not be read, and reads it again on request', async () => {
    const { user, backend } = await openApp({ page: 'courses' });
    await screen.findByRole('heading', { name: 'Kurslar' });
    backend.failNext('POST', '/applications/search', 500);

    await user.click(screen.getByRole('button', { name: 'İdarəetmə paneli' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server xətası');
    expect(screen.queryByText('Bütün yeni müraciətlərə baxılıb.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 yeni müraciət cavab gözləyir' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yenidən cəhd et' }));

    expect(await screen.findByText('1 gündür gözləyir')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('opens an application from the list, over the dashboard', async () => {
    const { user } = await openApp();
    const waiting = await screen.findByRole('region', { name: 'Cavab gözləyənlər' });

    await user.click(within(waiting).getByRole('button', { name: /Aysel Test/ }));

    const drawer = await screen.findByRole('dialog', { name: 'Müraciət detalları' });
    expect(await within(drawer).findByRole('heading', { name: 'Aysel Test' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /yeni müraciət/ })).toBeInTheDocument(); // still the dashboard
  });

  it('lists the newest applications and goes on to all of them', async () => {
    const { user } = await openApp();
    const latest = await screen.findByRole('region', { name: 'Son müraciətlər' });

    expect(within(latest).getAllByRole('listitem')).toHaveLength(5);
    expect(within(latest).getByText('Murad Test · 10 yaş')).toBeInTheDocument();
    expect(within(latest).getAllByText('Yeni')).toHaveLength(2);

    await user.click(within(latest).getByRole('button', { name: 'Hamısına bax' }));
    expect(await screen.findByRole('heading', { name: 'Qeydiyyatlar' })).toBeInTheDocument();
  });

  it('draws the seats of each course', async () => {
    await openApp({
      courses: [
        makeCourse(),
        makeCourse({
          id: 'course-2',
          title: '16 yanvar – 21 fevral 2027',
          registration_open: false,
          capacity: 2,
        }),
      ],
    });

    const seats = await screen.findByRole('region', { name: 'Kurslarda yerlər' });
    expect(within(seats).getByText('5 dekabr 2026 – 10 yanvar 2027')).toBeInTheDocument();
    expect(within(seats).getByText('1 / 20 təsdiqlənib · 650 AZN')).toBeInTheDocument();
    expect(within(seats).getByText('Aktiv')).toBeInTheDocument();
    expect(
      within(seats).getByRole('img', { name: 'Təsdiqlənib: 1, gözləyir: 3, boş: 16' }),
    ).toBeInTheDocument();
    expect(within(seats).getByText('2 boş')).toBeInTheDocument();
  });

  it('says so when no course is open on the site', async () => {
    await openApp({ courses: [makeCourse({ registration_open: false })] });

    expect(
      await screen.findByText('Saytda aktiv kurs yoxdur. Qeydiyyat formu müraciət qəbul etmir.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Saytda aktiv kurs seçilməyib.')).toBeInTheDocument();
  });

  it('is calm when nothing has come yet', async () => {
    await openApp({ applications: [] });

    expect(await screen.findByRole('heading', { name: 'Hələ müraciət gəlməyib' })).toBeInTheDocument();
    expect(screen.getByText('Bütün yeni müraciətlərə baxılıb.')).toBeInTheDocument();
    expect(screen.getByText('Hələ müraciət gəlməyib.')).toBeInTheDocument();
  });

  it('says all are answered once none is new', async () => {
    await openApp({ applications: applicationsOf(['approved', 'declined', 'contacted']) });

    expect(await screen.findByRole('heading', { name: 'Bütün müraciətlərə baxılıb' })).toBeInTheDocument();
    expect(screen.getByText('Bütün yeni müraciətlərə baxılıb.')).toBeInTheDocument();
  });

  it('shows the full seats of a course that is full', async () => {
    await openApp({ courses: [makeCourse({ capacity: 1 })] });

    expect(await screen.findByText('Boş yer yoxdur')).toBeInTheDocument();
    expect(screen.getByText('Dolub')).toBeInTheDocument();
  });

  it('names the day of the chart under the pointer', async () => {
    await openApp();
    await screen.findByRole('heading', { name: 'Müraciət axını' });
    const chart = screen.getByRole('img', { name: /Son 30 gündə 5 müraciət/ });
    const bars = chart.querySelectorAll<HTMLElement>('[title]');

    fireEvent.mouseEnter(bars[29]!);

    expect(screen.getByText('18 okt 2026 · 1 müraciət')).toBeInTheDocument();
    fireEvent.mouseLeave(chart);
    expect(screen.getByText('Gündəlik daxil olan müraciətlər')).toBeInTheDocument();
  });

  it('offers to try again when the figures cannot be loaded', async () => {
    const { user, backend } = await openApp({ signedIn: true, page: '' });
    backend.failNext('GET', /\/dashboard/, 500, {}, 1);
    await user.click(screen.getByRole('button', { name: 'Kurslar' }));
    await user.click(screen.getByRole('button', { name: 'İdarəetmə paneli' }));

    await user.click(await screen.findByRole('button', { name: 'Yenidən cəhd et' }));

    expect(await screen.findByRole('heading', { name: /yeni müraciət/ })).toBeInTheDocument();
  });
});
