import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openApp } from '../test/app.tsx';
import type { Opened } from '../test/app.tsx';
import { applicationsOf, makeApplication, makeCourse } from '../test/fixtures.ts';

const SECOND = makeCourse({
  id: 'course-2',
  title: '16 yanvar – 21 fevral 2027',
  start_date: '2027-01-16',
  end_date: '2027-02-21',
  registration_open: false,
  price_minor: 50_000,
});

async function open(options: Parameters<typeof openApp>[0] = {}): Promise<Opened> {
  const app = await openApp({ page: 'courses', ...options });
  await screen.findByRole('heading', { name: 'Kurslar', level: 1 });
  await screen.findAllByRole('article');
  return app;
}

const cards = () => screen.getAllByRole('article');
const cardOf = (title: string) =>
  within(cards().find((card) => within(card).queryByRole('heading', { name: title }))!);
const dialog = (name: string) => screen.findByRole('dialog', { name });

describe('the courses', () => {
  it('shows each course with its figures, its seats and what it costs', async () => {
    await open();

    const card = cardOf('5 dekabr 2026 – 10 yanvar 2027');
    expect(card.getByText('8–13 yaş')).toBeInTheDocument();
    expect(card.getAllByText('Saytda aktiv')).toHaveLength(2); // the label of the course and of the switch
    expect(card.getByText('650')).toBeInTheDocument();
    expect(card.getByText('Standart qiymət')).toBeInTheDocument();
    expect(card.getByText('6 həftə')).toBeInTheDocument();
    expect(card.getByText('Şənbə, 09:30–13:00')).toBeInTheDocument();
    expect(card.getByText('Bakı')).toBeInTheDocument();
    expect(card.getByText('500 AZN')).toBeInTheDocument();
    expect(card.getByText(/1 \/ 20/)).toBeInTheDocument();
    expect(card.getByText('19 boş yer')).toBeInTheDocument();
    expect(card.getByRole('button', { name: /İştirakçılar/ })).toHaveTextContent('5');
  });

  it('names the switch with the words it shows and the course, and lets the switch say whether it is on', async () => {
    await open({ courses: [makeCourse(), SECOND] });

    const on = cardOf('5 dekabr 2026 – 10 yanvar 2027').getByRole('switch', {
      name: 'Saytda aktiv: 5 dekabr 2026 – 10 yanvar 2027',
    });
    const off = cardOf('16 yanvar – 21 fevral 2027').getByRole('switch', {
      name: 'Saytda aktiv: 16 yanvar – 21 fevral 2027',
    });

    expect(on).toBeChecked();
    expect(off).not.toBeChecked();
    expect(on).toHaveTextContent('Saytda aktiv'); // what is seen is in the name (WCAG 2.5.3)
    expect(off).toHaveTextContent('Saytda aktiv'); // and it does not change with the state
  });

  it('says which course the landing page form is tied to', async () => {
    await open({ courses: [makeCourse(), SECOND] });

    const banner = screen.getByText('Saytdakı qeydiyyat formu').parentElement as HTMLElement;
    expect(within(banner).getByText('5 dekabr 2026 – 10 yanvar 2027')).toBeInTheDocument();
    expect(within(banner).getByText('1 / 20 təsdiqlənib · 19 boş yer')).toBeInTheDocument();
    expect(within(banner).queryByRole('note')).not.toBeInTheDocument();
  });

  it('warns when more than one course is open on the site, as can happen outside the panel', async () => {
    await open({ courses: [makeCourse(), { ...SECOND, registration_open: true }] });

    const banner = screen.getByText('Saytdakı qeydiyyat formu').parentElement as HTMLElement;
    expect(within(banner).getByRole('note')).toHaveTextContent('Daha 1 kurs da aktivdir');
  });

  it('says so when no course is tied to the form', async () => {
    await open({ courses: [makeCourse({ registration_open: false })] });

    expect(screen.getByText('Aktiv kurs yoxdur')).toBeInTheDocument();
    expect(screen.getByText(/“Saytda aktiv” açarını yandırın/)).toBeInTheDocument();
    expect(screen.getByText('Qeydiyyat bağlı')).toBeInTheDocument();
  });

  it('tells a pilot price, a standard price and a special one apart', async () => {
    await open({
      courses: [
        makeCourse(),
        SECOND,
        makeCourse({ id: 'course-3', title: 'Xüsusi qrup', price_minor: 70_000 }),
      ],
    });

    expect(cardOf('16 yanvar – 21 fevral 2027').getByText('Pilot qiymət')).toBeInTheDocument();
    expect(cardOf('Xüsusi qrup').getByText('Xüsusi qiymət')).toBeInTheDocument();
  });

  it('marks a course that is full', async () => {
    await open({ courses: [makeCourse({ capacity: 1 }), SECOND] });

    const full = cardOf('5 dekabr 2026 – 10 yanvar 2027');
    expect(full.getByText('Saytda aktiv · dolub')).toBeInTheDocument();
    expect(full.getByText('Boş yer yoxdur')).toBeInTheDocument();
  });

  it('shows a course without an end date as long as nobody says how long', async () => {
    await open({ courses: [makeCourse({ end_date: null })] });

    expect(cardOf('5 dekabr 2026 – 10 yanvar 2027').getByText('—')).toBeInTheDocument();
  });

  it('is read-only for a role that may not change courses', async () => {
    await open({ role: 'coordinator' });

    expect(screen.queryByRole('button', { name: /Yeni kurs/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Redaktə et/ })).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
    expect(screen.getByRole('button', { name: /İştirakçılar/ })).toBeInTheDocument();
  });

  it('says how many applications a course has, whatever their status', async () => {
    await open({ applications: applicationsOf(['new', 'declined']) });

    expect(cards()[0]).toHaveTextContent('İştirakçılar2');
  });

  it('offers to try again when the courses cannot be loaded', async () => {
    const { user, backend } = await openApp({ page: 'courses' });
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: 'İdarəetmə paneli' }));
    await screen.findByRole('heading', { name: /yeni müraciət/ });
    backend.failNext('GET', '/courses?limit=100', 500);
    await user.click(screen.getByRole('button', { name: 'Kurslar' }));

    await user.click(await screen.findByRole('button', { name: 'Yenidən cəhd et' }));

    expect(await screen.findAllByRole('article')).toHaveLength(1);
  });
});

describe('tying the form to a course', () => {
  it('opens the new course first and closes the other after it, so the form is never without one', async () => {
    const { user, backend } = await open({ courses: [makeCourse(), SECOND] });

    await user.click(cardOf('16 yanvar – 21 fevral 2027').getByRole('switch'));

    expect(await screen.findByText('16 yanvar – 21 fevral 2027 aktivdir')).toBeInTheDocument();
    const patches = backend.called('PATCH', /\/courses\//).map((request) => [request.path, request.body]);
    expect(patches).toEqual([
      ['/courses/course-2', { registration_open: true }],
      ['/courses/course-1', { registration_open: false }],
    ]);
    expect(screen.getByText(/5 dekabr 2026 – 10 yanvar 2027 üçün qeydiyyat bağlandı/)).toBeInTheDocument();
    await waitFor(() => expect(cardOf('16 yanvar – 21 fevral 2027').getByRole('switch')).toBeChecked());
    expect(cardOf('5 dekabr 2026 – 10 yanvar 2027').getByRole('switch')).not.toBeChecked();
  });

  it('closes registration when the active course is switched off', async () => {
    const { user, backend } = await open();

    await user.click(screen.getByRole('switch'));

    expect(await screen.findByText('Qeydiyyat bağlandı')).toBeInTheDocument();
    expect(backend.called('PATCH', '/courses/course-1')[0]?.body).toEqual({ registration_open: false });
    await waitFor(() => expect(screen.getByText('Aktiv kurs yoxdur')).toBeInTheDocument());
  });

  it('shows what the server did when a switch fails', async () => {
    const { user, backend } = await open();
    backend.failNext('PATCH', '/courses/course-1', 500);

    await user.click(screen.getByRole('switch'));

    expect(await screen.findByText('Server xətası')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeChecked();
  });
});

describe('a new course', () => {
  it('names itself from the dates and offers an end six weeks later', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));
    const form = within(await dialog('Yeni kurs'));

    fireEvent.change(form.getByLabelText('Başlanğıc tarixi'), { target: { value: '2027-03-06' } });

    expect(form.getByLabelText('Bitmə tarixi')).toHaveValue('2027-04-16');
    expect(form.getByText('6 mart – 16 aprel 2027')).toBeInTheDocument();
    expect(form.getByText('7 həftə')).toBeInTheDocument();
  });

  it('asks for what is missing and says where', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));
    const form = within(await dialog('Yeni kurs'));

    await user.click(form.getByRole('button', { name: 'Kursu yarat' }));

    expect(form.getByText('Başlanğıc tarixini seçin.')).toBeInTheDocument();
    expect(await screen.findByText('Formada xəta var')).toBeInTheDocument();
    expect(backend.called('POST', '/courses')).toHaveLength(0);

    fireEvent.change(form.getByLabelText('Başlanğıc tarixi'), { target: { value: '2027-03-06' } });
    expect(form.queryByText('Başlanğıc tarixini seçin.')).not.toBeInTheDocument();
  });

  it('takes the focus to the first box that is wrong, and ties the message to it', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));
    const form = within(await dialog('Yeni kurs'));

    await user.click(form.getByRole('button', { name: 'Kursu yarat' }));

    const start = form.getByLabelText('Başlanğıc tarixi');
    await waitFor(() => expect(start).toHaveFocus());
    expect(start).toBeInvalid();
    expect(start).toHaveAccessibleDescription('Başlanğıc tarixini seçin.');
    expect(form.getByText('Başlanğıc tarixini seçin.')).toHaveAttribute('role', 'alert');
  });

  it('checks the end date, the price and the places', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));
    const form = within(await dialog('Yeni kurs'));
    fireEvent.change(form.getByLabelText('Başlanğıc tarixi'), { target: { value: '2027-03-06' } });
    fireEvent.change(form.getByLabelText('Bitmə tarixi'), { target: { value: '2027-03-01' } });
    await user.clear(form.getByLabelText('Kursun qiyməti (AZN)'));
    await user.type(form.getByLabelText('Kursun qiyməti (AZN)'), '0');
    await user.clear(form.getByLabelText('Maksimum iştirakçı'));
    await user.type(form.getByLabelText('Maksimum iştirakçı'), '0');

    await user.click(form.getByRole('button', { name: 'Kursu yarat' }));

    expect(form.getByText('Bitmə tarixi başlanğıcdan sonra olmalıdır.')).toBeInTheDocument();
    expect(form.getByText('Qiymət 0-dan böyük olmalıdır.')).toBeInTheDocument();
    expect(form.getByText('Ən azı 1 iştirakçı olmalıdır.')).toBeInTheDocument();
  });

  it('sends the course the form describes, in qəpik, and shows it', async () => {
    const { user, backend } = await open({ courses: [makeCourse({ registration_open: false })] });
    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));
    const form = within(await dialog('Yeni kurs'));
    fireEvent.change(form.getByLabelText('Başlanğıc tarixi'), { target: { value: '2027-03-06' } });
    fireEvent.change(form.getByLabelText('Bitmə tarixi'), { target: { value: '2027-04-10' } });
    await user.clear(form.getByLabelText('Cədvəl'));
    await user.type(form.getByLabelText('Cədvəl'), 'Bazar, 10:00');
    await user.click(form.getByRole('button', { name: 'Pilot · 500' }));
    expect(form.getByLabelText('Kursun qiyməti (AZN)')).toHaveValue('500');
    await user.clear(form.getByLabelText('İkinci uşaq üçün (AZN)'));
    await user.type(form.getByLabelText('İkinci uşaq üçün (AZN)'), '400,50');
    await user.clear(form.getByLabelText('Maksimum iştirakçı'));
    await user.type(form.getByLabelText('Maksimum iştirakçı'), '16');

    await user.click(form.getByRole('button', { name: 'Kursu yarat' }));

    expect(await screen.findByText('Kurs yaradıldı')).toBeInTheDocument();
    expect(backend.called('POST', '/courses')[0]?.body).toEqual({
      title: '6 mart – 10 aprel 2027',
      start_date: '2027-03-06',
      end_date: '2027-04-10',
      schedule: 'Bazar, 10:00',
      location: 'Bakı',
      age_min: 8,
      age_max: 13,
      price_minor: 50_000,
      second_child_price_minor: 40_050,
      capacity: 16,
      registration_open: true,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('heading', { name: '6 mart – 10 aprel 2027' })).toBeInTheDocument();
  });

  it('closes the course that was open when the new one is tied to the form', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));
    const form = within(await dialog('Yeni kurs'));
    await user.click(form.getByRole('switch'));
    expect(form.getByRole('switch')).toBeChecked();
    expect(
      form.getByText(/Hazırda aktiv olan “5 dekabr 2026 – 10 yanvar 2027” avtomatik bağlanacaq/),
    ).toBeInTheDocument();
    fireEvent.change(form.getByLabelText('Başlanğıc tarixi'), { target: { value: '2027-03-06' } });

    await user.click(form.getByRole('button', { name: 'Kursu yarat' }));

    expect(await screen.findByText('Kurs yaradıldı')).toBeInTheDocument();
    expect(backend.called('PATCH', '/courses/course-1')[0]?.body).toEqual({ registration_open: false });
    expect(screen.getByText(/5 dekabr 2026 – 10 yanvar 2027 üçün qeydiyyat bağlandı/)).toBeInTheDocument();
  });

  it('starts closed when another course is open', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));

    expect(within(await dialog('Yeni kurs')).getByRole('switch')).not.toBeChecked();
  });

  it('closes without saving: with Cancel, with Escape and by a click outside', async () => {
    const { user, backend } = await open();

    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));
    await user.click(within(await dialog('Yeni kurs')).getByRole('button', { name: 'Ləğv et' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yeni kurs' }));
    await dialog('Yeni kurs');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Yeni kurs yarat/ }));
    const form = await dialog('Yeni kurs');
    await user.click(form.parentElement as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(backend.called('POST', '/courses')).toHaveLength(0);
  });
});

describe('changing a course', () => {
  it('shows what is stored and sends only what changed', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: /Redaktə et/ }));
    const form = within(await dialog('Kursu redaktə et'));

    expect(form.getByLabelText('Başlanğıc tarixi')).toHaveValue('2026-12-05');
    expect(form.getByLabelText('Bitmə tarixi')).toHaveValue('2027-01-10');
    expect(form.getByLabelText('Kursun qiyməti (AZN)')).toHaveValue('650');
    expect(form.getByLabelText('İkinci uşaq üçün (AZN)')).toHaveValue('500');
    expect(form.getByLabelText('Maksimum iştirakçı')).toHaveValue('20');
    expect(form.getByText('Hazırda 1 təsdiqlənmiş iştirakçı · 19 boş yer')).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Standart · 650' })).toHaveAttribute('aria-pressed', 'true');

    await user.clear(form.getByLabelText('Maksimum iştirakçı'));
    await user.type(form.getByLabelText('Maksimum iştirakçı'), '25');
    await user.click(form.getByRole('button', { name: 'Dəyişiklikləri saxla' }));

    expect(await screen.findByText('Kurs yeniləndi')).toBeInTheDocument();
    expect(screen.getByText('5 dekabr 2026 – 10 yanvar 2027: 24 boş yer')).toBeInTheDocument();
    expect(backend.called('PATCH', '/courses/course-1')[0]?.body).toEqual({ capacity: 25 });
    await waitFor(() =>
      expect(cardOf('5 dekabr 2026 – 10 yanvar 2027').getByText('24 boş yer')).toBeInTheDocument(),
    );
  });

  it('keeps the name of a course while its dates stay, and makes a new one when they move', async () => {
    const { user, backend } = await open({ courses: [makeCourse({ title: 'Pilot qrup' })] });
    await user.click(screen.getByRole('button', { name: /Redaktə et/ }));
    const form = within(await dialog('Kursu redaktə et'));
    await user.clear(form.getByLabelText('Cədvəl'));
    await user.type(form.getByLabelText('Cədvəl'), 'Bazar');
    await user.click(form.getByRole('button', { name: 'Dəyişiklikləri saxla' }));
    await screen.findByText('Kurs yeniləndi');

    expect(backend.called('PATCH', '/courses/course-1')[0]?.body).toEqual({ schedule: 'Bazar' });
  });

  it('wants at least one place', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: /Redaktə et/ }));
    const form = within(await dialog('Kursu redaktə et'));
    await user.clear(form.getByLabelText('Maksimum iştirakçı'));
    await user.type(form.getByLabelText('Maksimum iştirakçı'), '0');

    await user.click(form.getByRole('button', { name: 'Dəyişiklikləri saxla' }));

    expect(form.getByText('Ən azı 1 iştirakçı olmalıdır.')).toBeInTheDocument();
    expect(backend.called('PATCH', /courses/)).toHaveLength(0);
  });

  it('does not lower the places below the approved children, and says how many there are', async () => {
    const { user, backend } = await open({
      applications: applicationsOf(['approved', 'approved', 'approved']),
    });
    await user.click(screen.getByRole('button', { name: /Redaktə et/ }));
    const form = within(await dialog('Kursu redaktə et'));
    await user.clear(form.getByLabelText('Maksimum iştirakçı'));
    await user.type(form.getByLabelText('Maksimum iştirakçı'), '2');

    await user.click(form.getByRole('button', { name: 'Dəyişiklikləri saxla' }));

    expect(form.getByText('Bu kursda artıq 3 təsdiqlənmiş iştirakçı var.')).toBeInTheDocument();
    expect(backend.called('PATCH', /courses/)).toHaveLength(0);
  });

  it('shows the server refusal against the field when someone approved meanwhile', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: /Redaktə et/ }));
    const form = within(await dialog('Kursu redaktə et'));
    await user.clear(form.getByLabelText('Maksimum iştirakçı'));
    await user.type(form.getByLabelText('Maksimum iştirakçı'), '5');
    backend.failNext('PATCH', '/courses/course-1', 409, {
      code: 'capacity_below_approved',
      approved_children: 7,
    });

    await user.click(form.getByRole('button', { name: 'Dəyişiklikləri saxla' }));

    expect(await form.findByText('Bu kursda artıq 7 təsdiqlənmiş iştirakçı var.')).toBeInTheDocument();
    expect(await screen.findByText('Yer sayı azdır')).toBeInTheDocument();
  });

  it('can take the end date away', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: /Redaktə et/ }));
    const form = within(await dialog('Kursu redaktə et'));

    fireEvent.change(form.getByLabelText('Bitmə tarixi'), { target: { value: '' } });
    await user.click(form.getByRole('button', { name: 'Dəyişiklikləri saxla' }));

    await screen.findByText('Kurs yeniləndi');
    expect(backend.called('PATCH', '/courses/course-1')[0]?.body).toMatchObject({ end_date: null });
  });

  it('shows the field a 422 names', async () => {
    const { user, backend } = await open();
    await user.click(screen.getByRole('button', { name: /Redaktə et/ }));
    const form = within(await dialog('Kursu redaktə et'));
    await user.clear(form.getByLabelText('Cədvəl'));
    await user.type(form.getByLabelText('Cədvəl'), 'Bazar');
    backend.failNext('PATCH', '/courses/course-1', 422, {
      detail: [{ loc: ['body', 'schedule'], type: 'string_pattern_mismatch' }],
    });

    await user.click(form.getByRole('button', { name: 'Dəyişiklikləri saxla' }));

    expect(await form.findByText('Dəyər qəbul olunmadı.')).toBeInTheDocument();
  });
});

describe('the people of a course', () => {
  it('lists the applications, the approved first', async () => {
    const { user } = await open();

    await user.click(screen.getByRole('button', { name: /İştirakçılar/ }));

    const people = within(await dialog('İştirakçılar'));
    expect(await people.findByText('5 müraciət', { exact: false })).toBeInTheDocument();
    const names = people.getAllByRole('button').filter((button) => button.textContent?.includes('Valideyn:'));
    expect(names.map((button) => button.textContent)).toEqual([
      expect.stringContaining('Nərgiz Fake'), // approved
      expect.stringContaining('Emil Sınaq'), // contacted
      expect.stringContaining('Murad Test'), // new, newest first
      expect.stringContaining('Ayan Nümunə'),
      expect.stringContaining('Kənan Demo'), // declined
    ]);
    expect(people.getAllByText('Təsdiqlənib')).toHaveLength(1);
  });

  it('says so when nobody applied', async () => {
    const { user } = await open({ applications: [] });

    await user.click(screen.getByRole('button', { name: /İştirakçılar/ }));

    expect(
      await within(await dialog('İştirakçılar')).findByText('Bu kurs üçün hələ müraciət yoxdur.'),
    ).toBeInTheDocument();
  });

  it('closes with its button', async () => {
    const { user } = await open();
    await user.click(screen.getByRole('button', { name: /İştirakçılar/ }));

    await user.click(within(await dialog('İştirakçılar')).getByRole('button', { name: 'Bağla' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says so when the list cannot be loaded', async () => {
    const { user, backend } = await open();
    backend.failNext('POST', '/applications/search', 500);
    await user.click(screen.getByRole('button', { name: /İştirakçılar/ }));

    const people = within(await dialog('İştirakçılar'));
    await user.click(await people.findByRole('button', { name: 'Yenidən cəhd et' }));

    expect(await people.findByText(/Nərgiz Fake/)).toBeInTheDocument();
  });

  it('points at the first hundred when there are more', async () => {
    const many = Array.from({ length: 105 }, (_, index) => makeApplication(`many-${index}`));
    const { user } = await open({ applications: many });

    await user.click(screen.getByRole('button', { name: /İştirakçılar/ }));

    expect(
      await within(await dialog('İştirakçılar')).findByText(/İlk 100 müraciət göstərilir/),
    ).toBeInTheDocument();
  });
});
