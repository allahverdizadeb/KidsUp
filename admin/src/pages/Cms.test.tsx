import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { openApp } from '../test/app.tsx';
import type { Opened } from '../test/app.tsx';
import { makeContent, makeCourse } from '../test/fixtures.ts';

async function open(options: Parameters<typeof openApp>[0] = {}): Promise<Opened> {
  const app = await openApp({ page: 'cms', ...options });
  await screen.findByRole('heading', { name: 'Saytın idarə edilməsi', level: 1 });
  await editor('Əsas bölmə');
  return app;
}

const editor = (name: string) => screen.findByRole('region', { name });
const sections = () => within(screen.getByRole('navigation', { name: 'Sayt bölmələri' }));
const stateOf = (region: HTMLElement) =>
  within(region).getByText(/Yadda saxlanmayıb|Dərc gözləyir|Dərc olunub/).textContent;

async function pick(user: Opened['user'], name: string) {
  await user.click(sections().getByRole('button', { name: new RegExp(`^${name}`) }));
  return within(await editor(name));
}

async function typeInto(user: Opened['user'], field: HTMLElement, text: string) {
  await user.clear(field);
  await user.type(field, text);
}

describe('the sections', () => {
  it('lists the sections of the page and opens the first on a wide screen', async () => {
    await open();

    expect(sections().getAllByRole('button')).toHaveLength(4);
    for (const name of ['Əsas bölmə', 'Demo Day', 'Tez-tez verilən suallar', 'Qurucu']) {
      expect(sections().getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument();
    }
    const hero = within(await editor('Əsas bölmə'));
    expect(hero.getByLabelText('Başlıq, 1-ci sətir')).toHaveValue('Kiçik ideyalar.');
    expect(hero.getByLabelText('Alt başlıq')).toHaveValue(
      '{age_min}–{age_max} yaşlı uşaqlar üçün praktiki sahibkarlıq proqramı.',
    );
    expect(hero.getByText('15/80')).toBeInTheDocument();
    expect(hero.getByText('Hələ dərc olunmayıb: sayt öz mətnlərini göstərir')).toBeInTheDocument();
  });

  it('says that a section is published, from the start', async () => {
    await open();

    expect(stateOf(await editor('Əsas bölmə'))).toBe('Dərc olunub');
    expect(screen.queryByRole('button', { name: /Hamısını dərc et/ })).not.toBeInTheDocument();
  });

  it('names the words that become figures of the course', async () => {
    await open();

    expect(within(await editor('Əsas bölmə')).getByText(/{age_max}, {age_min}, {price}/)).toBeInTheDocument();
  });

  it('offers to try again when the page content cannot be loaded', async () => {
    const { user, backend } = await openApp({ page: 'dash' });
    await screen.findByRole('heading', { name: /yeni müraciət/ });
    backend.failNext('GET', '/content', 500);
    await user.click(screen.getByRole('button', { name: 'Saytın idarə edilməsi' }));

    await user.click(await screen.findByRole('button', { name: 'Yenidən cəhd et' }));

    expect(await editor('Əsas bölmə')).toBeInTheDocument();
  });
});

describe('editing and saving a draft', () => {
  it('marks the section as not saved, and a click puts the place back to the page own text', async () => {
    const { user } = await open();
    const hero = within(await editor('Əsas bölmə'));

    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');

    expect(stateOf(await editor('Əsas bölmə'))).toBe('Yadda saxlanmayıb');
    expect(sections().getByRole('button', { name: /^Əsas bölmə.*Yadda saxlanmayıb$/ })).toBeInTheDocument();
    await user.click(hero.getByRole('button', { name: 'Standarta qaytar' }));
    expect(hero.getByLabelText('Başlıq, 1-ci sətir')).toHaveValue('Kiçik ideyalar.');
    expect(stateOf(await editor('Əsas bölmə'))).toBe('Dərc olunub');
  });

  it('saves only what changed, as a draft that is not yet on the page', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');

    await user.click(hero.getByRole('button', { name: 'Yadda saxla' }));

    expect(await screen.findByText('Yadda saxlanıldı')).toBeInTheDocument();
    expect(backend.called('PUT', '/content')[0]?.body).toEqual({
      values: { 'hero.title_first': 'Yeni başlıq' },
    });
    expect(backend.called('PUT', '/content')[0]?.headers['x-csrf-token']).toBeTruthy();
    expect(backend.called('POST', '/content/publications')).toHaveLength(0);
    await waitFor(() =>
      expect(stateOf(screen.getByRole('region', { name: 'Əsas bölmə' }))).toBe('Dərc gözləyir'),
    );
    expect(screen.getByRole('button', { name: /Hamısını dərc et/ })).toHaveTextContent('1');
  });

  it('sends null for a place put back to its own text, so it leaves the draft', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');
    await user.click(hero.getByRole('button', { name: 'Yadda saxla' }));
    await screen.findByText('Yadda saxlanıldı');

    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Kiçik ideyalar.');
    await user.click(hero.getByRole('button', { name: 'Yadda saxla' }));

    await waitFor(() => expect(backend.called('PUT', '/content')).toHaveLength(2));
    expect(backend.called('PUT', '/content')[1]?.body).toEqual({ values: { 'hero.title_first': null } });
  });

  it('cannot save when nothing changed', async () => {
    const { user, backend } = await open();

    expect(within(await editor('Əsas bölmə')).getByRole('button', { name: 'Yadda saxla' })).toBeDisabled();
    await user.click(
      within(await editor('Əsas bölmə')).getByRole('button', { name: 'Dəyişiklikləri ləğv et' }),
    );

    expect(backend.called('PUT', '/content')).toHaveLength(0);
  });

  it('takes back what was typed with Cancel changes', async () => {
    const { user } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');

    await user.click(hero.getByRole('button', { name: 'Dəyişiklikləri ləğv et' }));

    expect(await screen.findByText('Dəyişikliklər ləğv olundu')).toBeInTheDocument();
    expect(hero.getByLabelText('Başlıq, 1-ci sətir')).toHaveValue('Kiçik ideyalar.');
  });

  it('holds back a text that is too long', async () => {
    const { user } = await open();
    const hero = within(await editor('Əsas bölmə'));

    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'x'.repeat(100));

    expect(hero.getByLabelText('Başlıq, 1-ci sətir')).toHaveValue('x'.repeat(80));
    expect(hero.getByText('80/80')).toBeInTheDocument();
  });

  it('keeps what was typed when the page is left and come back to', async () => {
    const { user } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yarımçıq mətn');

    await user.click(screen.getByRole('button', { name: 'Kurslar' }));
    await screen.findByRole('heading', { name: 'Kurslar', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Saytın idarə edilməsi' }));

    expect(within(await editor('Əsas bölmə')).getByLabelText('Başlıq, 1-ci sətir')).toHaveValue(
      'Yarımçıq mətn',
    );
  });

  it('asks before the tab is closed with text that was not saved, and not otherwise', async () => {
    const { user } = await open();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await typeInto(user, within(await editor('Əsas bölmə')).getByLabelText('Başlıq, 1-ci sətir'), 'Yeni');

    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it('shows the place the server refused and why, and keeps the text', async () => {
    const { user } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), '   ');

    await user.click(hero.getByRole('button', { name: 'Yadda saxla' }));

    expect(await screen.findByText('“Başlıq, 1-ci sətir” saxlanmadı')).toBeInTheDocument();
    expect(screen.getAllByText('Boş qala bilməz.')).toHaveLength(2); // in the message and under the place
    expect(stateOf(await editor('Əsas bölmə'))).toBe('Yadda saxlanmayıb');

    await user.type(hero.getByLabelText('Başlıq, 1-ci sətir'), 'a');
    expect(hero.queryAllByText('Boş qala bilməz.')).toHaveLength(0);
  });

  it('says so when the server cannot be reached', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni');
    backend.failNext('PUT', '/content', 503, { code: 'public_file_failed' });

    await user.click(hero.getByRole('button', { name: 'Yadda saxla' }));

    expect(await screen.findByText('Sayta yazmaq alınmadı')).toBeInTheDocument();
  });
});

describe('publishing', () => {
  it('saves the changes and then publishes the places of that section only', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');

    await user.click(hero.getByRole('button', { name: 'Dərc et' }));

    expect(await screen.findByText('Dərc olundu')).toBeInTheDocument();
    expect(backend.called('PUT', '/content')).toHaveLength(1);
    expect(backend.called('POST', '/content/publications')[0]?.body).toEqual({
      keys: ['hero.title_first', 'hero.subtitle', 'hero.primary_cta'],
    });
    expect(backend.called('POST', '/content/publications')[0]?.headers['x-csrf-token']).toBeTruthy();
    await waitFor(() =>
      expect(stateOf(screen.getByRole('region', { name: 'Əsas bölmə' }))).toBe('Dərc olunub'),
    );
    expect(hero.getByText('Son dərc: 18 okt 2026, 15:30')).toBeInTheDocument();
    expect(backend.field('hero.title_first').draft).toBe('Yeni başlıq');
  });

  it('publishes a draft that was saved earlier, without saving again', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Alt başlıq'), 'Yeni alt başlıq');
    await user.click(hero.getByRole('button', { name: 'Yadda saxla' }));
    await screen.findByText('Yadda saxlanıldı');

    await user.click(hero.getByRole('button', { name: 'Dərc et' }));

    await screen.findByText('Dərc olundu');
    expect(backend.called('PUT', '/content')).toHaveLength(1);
    expect(backend.called('POST', '/content/publications')).toHaveLength(1);
  });

  it('leaves the other sections of the draft waiting', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');
    await user.click(hero.getByRole('button', { name: 'Yadda saxla' }));
    await screen.findByText('Yadda saxlanıldı');
    const faq = await pick(user, 'Tez-tez verilən suallar');
    await typeInto(user, faq.getByLabelText('Sual'), 'Yeni sual?');
    await user.click(faq.getByRole('button', { name: 'Yadda saxla' }));
    await waitFor(() => expect(backend.called('PUT', '/content')).toHaveLength(2));

    await user.click(faq.getByRole('button', { name: 'Dərc et' }));

    await screen.findByText('Dərc olundu');
    expect(backend.called('POST', '/content/publications')[0]?.body).toEqual({ keys: ['faq.items'] });
    await waitFor(() =>
      expect(sections().getByRole('button', { name: /^Əsas bölmə.*Dərc gözləyir$/ })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /Hamısını dərc et/ })).toHaveTextContent('1');
  });

  it('says so when there is nothing to publish', async () => {
    const { user, backend } = await open();

    await user.click(within(await editor('Əsas bölmə')).getByRole('button', { name: 'Dərc et' }));

    expect(await screen.findByText('Dəyişiklik yoxdur')).toBeInTheDocument();
    expect(backend.called('POST', '/content/publications')).toHaveLength(0);
  });

  it('publishes everything that waits with one button, saving first what was not saved', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');
    const demo = await pick(user, 'Demo Day');
    await typeInto(user, demo.getByLabelText('Demo Day-də nə olacaq, 1'), 'Yeni nümunə');
    expect(screen.getByRole('button', { name: /Hamısını dərc et/ })).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: /Hamısını dərc et/ }));

    expect(await screen.findByText('2 bölmə dərc olundu')).toBeInTheDocument();
    expect(backend.called('PUT', '/content')[0]?.body).toEqual({
      values: {
        'hero.title_first': 'Yeni başlıq',
        'demo_day.items': ['Yeni nümunə', 'Yekun təqdimat'],
      },
    });
    expect(backend.called('POST', '/content/publications')[0]?.body).toBeUndefined();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Hamısını dərc et/ })).not.toBeInTheDocument(),
    );
  });

  it('publishes nothing when saving failed', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), '   ');

    await user.click(hero.getByRole('button', { name: 'Dərc et' }));

    expect(await screen.findByText('“Başlıq, 1-ci sətir” saxlanmadı')).toBeInTheDocument();
    expect(backend.called('POST', '/content/publications')).toHaveLength(0);
    // The person is taken to the place that was refused, and it is told why.
    const field = hero.getByLabelText('Başlıq, 1-ci sətir');
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toBeInvalid();
    expect(field).toHaveAccessibleDescription(/\S/);
  });

  it('does not call a publication a failure when only the read after it fails', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');
    backend.failNext('GET', '/content', 500);

    await user.click(hero.getByRole('button', { name: 'Dərc et' }));

    expect(await screen.findByText('Dərc olundu')).toBeInTheDocument(); // it is on the site
    expect(await screen.findByText('Siyahı yenilənmədi')).toBeInTheDocument(); // and the screen says it is behind
    expect(screen.queryByText('Server xətası')).not.toBeInTheDocument();
    expect(backend.called('POST', '/content/publications')).toHaveLength(1);
  });

  it('says so when publishing fails', async () => {
    const { user, backend } = await open();
    const hero = within(await editor('Əsas bölmə'));
    await typeInto(user, hero.getByLabelText('Başlıq, 1-ci sətir'), 'Yeni başlıq');
    backend.failNext('POST', '/content/publications', 503, { code: 'public_file_failed' });

    await user.click(hero.getByRole('button', { name: 'Dərc et' }));

    expect(await screen.findByText('Sayta yazmaq alınmadı')).toBeInTheDocument();
    expect(stateOf(await editor('Əsas bölmə'))).toBe('Dərc gözləyir'); // saved, not published
  });

  it('says so when "publish all" fails', async () => {
    const { user, backend } = await open();
    await typeInto(
      user,
      within(await editor('Əsas bölmə')).getByLabelText('Başlıq, 1-ci sətir'),
      'Yeni başlıq',
    );
    backend.failNext('POST', '/content/publications', 500);

    await user.click(screen.getByRole('button', { name: /Hamısını dərc et/ }));

    expect(await screen.findByText('Server xətası')).toBeInTheDocument();
  });
});

describe('the prices', () => {
  const withPricing = () => {
    const base = makeContent();
    return {
      ...base,
      sections: [...base.sections, { id: 'pricing', label: 'Qiymət və iştirak' }],
      fields: [
        ...base.fields,
        {
          ...base.fields[0]!,
          key: 'pricing.heading',
          section: 'pricing',
          label: 'Başlıq',
          default: 'Qiymət və iştirak',
        },
      ],
    };
  };

  it('come from the course: the pricing section says so and leads to the courses', async () => {
    const { user } = await open({ content: withPricing() });
    expect(screen.queryByRole('button', { name: 'Kurslara keç' })).not.toBeInTheDocument(); // not in the other sections

    const pricing = await pick(user, 'Qiymət və iştirak');
    expect(pricing.getByText(/Qiymətlərin özü .* kursun məlumatından götürülür/)).toBeInTheDocument();
    await user.click(pricing.getByRole('button', { name: 'Kurslara keç' }));

    expect(await screen.findByRole('heading', { name: 'Kurslar', level: 1 })).toBeInTheDocument();
  });
});

describe('the kinds of place', () => {
  it('edits a list of short lines: add, change, remove, within the limits of the place', async () => {
    const { user, backend } = await open();
    const demo = await pick(user, 'Demo Day');
    const add = demo.getByRole('button', { name: 'Sətir əlavə et' });

    await user.click(add);
    expect(demo.getByLabelText('Demo Day-də nə olacaq, 3')).toHaveValue('');
    expect(add).toBeDisabled(); // three at most

    await user.type(demo.getByLabelText('Demo Day-də nə olacaq, 3'), 'Üçüncü');
    await user.click(demo.getByRole('button', { name: 'Demo Day-də nə olacaq, 1: sil' }));
    expect(demo.getAllByRole('textbox')).toHaveLength(2);
    await user.click(demo.getByRole('button', { name: 'Demo Day-də nə olacaq, 1: sil' }));
    expect(demo.getByRole('button', { name: 'Demo Day-də nə olacaq, 1: sil' })).toBeDisabled(); // one at least

    await user.click(demo.getByRole('button', { name: 'Yadda saxla' }));
    await screen.findByText('Yadda saxlanıldı');
    expect(backend.called('PUT', '/content')[0]?.body).toEqual({ values: { 'demo_day.items': ['Üçüncü'] } });
  });

  it('edits a list of items with several parts', async () => {
    const { user, backend } = await open();
    const faq = await pick(user, 'Tez-tez verilən suallar');
    expect(faq.getByLabelText('Sual')).toHaveValue('Qiymətə nələr daxildir?');
    expect(faq.getByRole('button', { name: 'Element 1: sil' })).toBeDisabled();

    await user.click(faq.getByRole('button', { name: 'Element əlavə et' }));
    const questions = faq.getAllByLabelText('Sual');
    await user.type(questions[1]!, 'Dərslər harada?');
    await user.type(faq.getAllByLabelText('Cavab')[1]!, 'Bakıda.');
    await user.click(faq.getByRole('button', { name: 'Yadda saxla' }));

    await screen.findByText('Yadda saxlanıldı');
    expect(backend.called('PUT', '/content')[0]?.body).toEqual({
      values: {
        'faq.items': [
          { q: 'Qiymətə nələr daxildir?', a: 'Materiallar və sertifikat.' },
          { q: 'Dərslər harada?', a: 'Bakıda.' },
        ],
      },
    });
  });

  it('stops adding items at the most the place takes', async () => {
    const { user } = await open();
    const faq = await pick(user, 'Tez-tez verilən suallar');

    await user.click(faq.getByRole('button', { name: 'Element əlavə et' }));
    await user.click(faq.getByRole('button', { name: 'Element əlavə et' }));

    expect(faq.queryByRole('button', { name: 'Element əlavə et' })).not.toBeInTheDocument();
    expect(faq.getAllByLabelText('Sual')).toHaveLength(3);
  });

  it('says which pictures are allowed and how big before one is chosen, and ties that to the box', async () => {
    const { user } = await open();
    const founder = await pick(user, 'Qurucu');

    expect(founder.getByText('JPG, PNG və ya WEBP, maksimum 5 MB.')).toBeInTheDocument();
    expect(founder.getByLabelText('Şəkil yüklə')).toHaveAccessibleDescription(
      'JPG, PNG və ya WEBP, maksimum 5 MB.',
    );
  });

  it('shows a picture of the page as the page own, and takes an upload for it', async () => {
    const { user, backend } = await open();
    const founder = await pick(user, 'Qurucu');
    expect(founder.getByText('Saytın öz şəkli')).toBeInTheDocument();
    expect(founder.queryByRole('button', { name: 'Standarta qaytar' })).not.toBeInTheDocument();

    await user.upload(
      founder.getByLabelText('Şəkil yüklə'),
      new File(['png'], 'photo.png', { type: 'image/png' }),
    );

    expect(await screen.findByText('Şəkil yükləndi')).toBeInTheDocument();
    const upload = backend.called('POST', '/media')[0];
    expect(upload?.headers['content-type']).toBe('image/png');
    expect(upload?.headers['x-csrf-token']).toBeTruthy();
    const picture = await founder.findByRole('img', { name: 'Şəkil' });
    expect(picture.style.backgroundImage).toContain('/media/00000000-0000-4000-8000-000000000001.webp');
    expect(founder.getByText('Dəyiş')).toBeInTheDocument();

    await user.click(founder.getByRole('button', { name: 'Yadda saxla' }));
    await screen.findByText('Yadda saxlanıldı');
    expect(backend.called('PUT', '/content')[0]?.body).toEqual({
      values: { 'founder.photo': '00000000-0000-4000-8000-000000000001' },
    });
  });

  it('takes the page own picture back', async () => {
    const { user } = await open();
    const founder = await pick(user, 'Qurucu');
    await user.upload(
      founder.getByLabelText('Şəkil yüklə'),
      new File(['png'], 'photo.png', { type: 'image/png' }),
    );
    await founder.findByRole('img', { name: 'Şəkil' });

    await user.click(founder.getByRole('button', { name: 'Standarta qaytar' }));

    expect(founder.queryByRole('img', { name: 'Şəkil' })).not.toBeInTheDocument();
    expect(founder.getByText('Saytın öz şəkli')).toBeInTheDocument();
  });

  it('refuses a file that is not a picture or is too big, before it leaves the computer', async () => {
    const { user, backend } = await open();
    const founder = await pick(user, 'Qurucu');
    const input = founder.getByLabelText('Şəkil yüklə');

    fireEvent.change(input, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('Fayl formatı uyğun deyil')).toBeInTheDocument();

    fireEvent.change(input, {
      target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })] },
    });
    expect(await screen.findByText('Şəkil çox böyükdür')).toBeInTheDocument();
    expect(backend.called('POST', '/media')).toHaveLength(0);
  });

  it('says why the server refused a picture', async () => {
    const { user, backend } = await open();
    const founder = await pick(user, 'Qurucu');
    backend.failNext('POST', '/media', 422, { code: 'invalid_image', reason: 'not_a_picture' });

    await user.upload(
      founder.getByLabelText('Şəkil yüklə'),
      new File(['png'], 'photo.png', { type: 'image/png' }),
    );

    expect(await screen.findByText('Şəkil qəbul olunmadı')).toBeInTheDocument();
    expect(screen.getByText('Fayl şəkil deyil və ya zədələnib.')).toBeInTheDocument();
    expect(founder.getByText('Saytın öz şəkli')).toBeInTheDocument();
  });
});

describe('the preview', () => {
  it('shows the page as it will read, with the figures of the course and the text not yet saved', async () => {
    const { user } = await open({ courses: [makeCourse()] });
    await typeInto(
      user,
      within(await editor('Əsas bölmə')).getByLabelText('Başlıq, 1-ci sətir'),
      'Yeni başlıq',
    );

    await user.click(within(await editor('Əsas bölmə')).getByRole('button', { name: 'Önizlə' }));

    const preview = within(await screen.findByRole('dialog', { name: 'Saytın önizləməsi' }));
    expect(preview.getByText('Önizləmə · dərc olunmayıb')).toBeInTheDocument();
    expect(preview.getByRole('heading', { level: 2, name: /Yeni başlıq/ })).toBeInTheDocument();
    expect(preview.getByText('8–13 yaşlı uşaqlar üçün praktiki sahibkarlıq proqramı.')).toBeInTheDocument();
    expect(preview.getByText('Qurucu')).toBeInTheDocument();
    expect(preview.getByText('Məhsul nümunəsi')).toBeInTheDocument(); // the list of Demo Day
    expect(preview.getByText('Qiymətə nələr daxildir?')).toBeInTheDocument(); // an item of the questions
    expect(preview.getByText(/Şəkil · saytın öz şəkli/)).toBeInTheDocument();
  });

  it('keeps the words as they are written where no course gives the figures', async () => {
    const { user } = await open({ courses: [] });

    await user.click(within(await editor('Əsas bölmə')).getByRole('button', { name: 'Önizlə' }));

    expect(
      within(await screen.findByRole('dialog', { name: 'Saytın önizləməsi' })).getByText(
        '{age_min}–{age_max} yaşlı uşaqlar üçün praktiki sahibkarlıq proqramı.',
      ),
    ).toBeInTheDocument();
  });

  it('closes with its button and with Escape', async () => {
    const { user } = await open();
    await user.click(within(await editor('Əsas bölmə')).getByRole('button', { name: 'Önizlə' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Saytın önizləməsi' })).getByRole('button', {
        name: 'Önizləməni bağla',
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(within(await editor('Əsas bölmə')).getByRole('button', { name: 'Önizlə' }));
    await screen.findByRole('dialog', { name: 'Saytın önizləməsi' });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('on a narrow screen', () => {
  it('takes turns: the list first, then one section with a way back', async () => {
    const { user } = await openApp({ page: 'cms', width: 600 });
    await screen.findByRole('heading', { name: 'Saytın idarə edilməsi', level: 1 });

    expect(screen.queryByRole('region', { name: 'Əsas bölmə' })).not.toBeInTheDocument();
    await user.click(sections().getByRole('button', { name: /^Demo Day/ }));
    const demo = within(await editor('Demo Day'));
    expect(screen.queryByRole('navigation', { name: 'Sayt bölmələri' })).not.toBeInTheDocument();

    await user.click(demo.getByRole('button', { name: 'Bölmələrə qayıt' }));
    expect(await screen.findByRole('navigation', { name: 'Sayt bölmələri' })).toBeInTheDocument();
  });
});
