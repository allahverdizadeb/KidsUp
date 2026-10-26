import { fireEvent, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { openApp } from './test/app.tsx';
import type { Opened } from './test/app.tsx';

// jsdom has no layout, so axe's colour-contrast rule cannot run here; the colours were computed from the design's values
// and are checked by eye in a real browser before release (what is known to fall short is ADM-1, ADM-2 and ADM-9 in
// admin/docs/README.md).
const rules = { 'color-contrast': { enabled: false } };

async function violationsIn(app: Opened) {
  const result = await axe.run(app.container, {
    rules,
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
  });
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.length} nodes) e.g. ${violation.nodes[0]?.html.slice(0, 140)}`,
  );
}

/** Fails with the text of every violation, so the report says what to fix. */
async function expectNoViolations(app: Opened) {
  expect((await violationsIn(app)).join('\n')).toBe('');
}

// Scanning a whole page is CPU-heavy, more so with coverage instrumentation.
const SCAN = { timeout: 60_000 };

describe('accessibility (axe, WCAG 2.2 AA + best practice)', () => {
  it('has no violations on the sign-in page', SCAN, async () => {
    const app = await openApp({ signedIn: false });
    await expectNoViolations(app);
  });

  it('has no violations on the sign-in page after a wrong attempt', SCAN, async () => {
    const app = await openApp({ signedIn: false });
    await app.user.click(screen.getByRole('button', { name: 'Daxil ol' }));
    await screen.findByText('E-poçtu daxil edin.');
    await expectNoViolations(app);
  });

  it.each([1440, 390])('has no violations on the dashboard at %i px', SCAN, async (width) => {
    const app = await openApp({ width });
    await screen.findByRole('heading', { name: /yeni müraciət/ });
    await expectNoViolations(app);
  });

  it('has no violations on the registrations as a table', SCAN, async () => {
    const app = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    await expectNoViolations(app);
  });

  it('has no violations on the registrations as cards on a phone', SCAN, async () => {
    const app = await openApp({ page: 'reg', width: 390 });
    await screen.findByText('Aysel Test');
    await expectNoViolations(app);
  });

  it('has no violations with the details of an application open', SCAN, async () => {
    const app = await openApp({ page: 'reg' });
    await app.user.click(await screen.findByRole('button', { name: 'Aysel Test' }));
    const sheet = await screen.findByRole('dialog', { name: 'Müraciət detalları' });
    await within(sheet).findByRole('heading', { name: 'Aysel Test' });
    await within(sheet).findByText('19 boş yer · 1/20');
    await expectNoViolations(app);
  });

  it('has no violations with the question about erasing open', SCAN, async () => {
    const app = await openApp({ page: 'reg' });
    await app.user.click(await screen.findByRole('button', { name: 'Aysel Test' }));
    await app.user.click(await screen.findByRole('button', { name: 'Müraciəti sil' }));
    await screen.findByRole('alertdialog');
    await expectNoViolations(app);
  });

  it('has no violations on the courses', SCAN, async () => {
    const app = await openApp({ page: 'courses' });
    await screen.findAllByRole('article');
    await expectNoViolations(app);
  });

  it('has no violations in the course window, also with faults shown', SCAN, async () => {
    const app = await openApp({ page: 'courses' });
    await app.user.click(await screen.findByRole('button', { name: 'Yeni kurs' }));
    const form = within(await screen.findByRole('dialog', { name: 'Yeni kurs' }));
    await expectNoViolations(app);
    await app.user.click(form.getByRole('button', { name: 'Kursu yarat' }));
    await form.findByText('Başlanğıc tarixini seçin.');
    await expectNoViolations(app);
  });

  it('has no violations in the window with the people of a course', SCAN, async () => {
    const app = await openApp({ page: 'courses' });
    await app.user.click(await screen.findByRole('button', { name: /İştirakçılar/ }));
    await within(await screen.findByRole('dialog', { name: 'İştirakçılar' })).findByText(/Nərgiz Fake/);
    await expectNoViolations(app);
  });

  it.each([1440, 390])('has no violations in the page editor at %i px', SCAN, async (width) => {
    const app = await openApp({ page: 'cms', width });
    if (width < 1180) fireEvent.click(await screen.findByRole('button', { name: /^Əsas bölmə/ }));
    await screen.findByRole('region', { name: 'Əsas bölmə' });
    await expectNoViolations(app);
  });

  it('has no violations in the editor for every kind of place', SCAN, async () => {
    const app = await openApp({ page: 'cms' });
    for (const name of ['Demo Day', 'Tez-tez verilən suallar', 'Qurucu']) {
      await app.user.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }));
      await screen.findByRole('region', { name });
      await expectNoViolations(app);
    }
  });

  it('has no violations in the preview of the page', SCAN, async () => {
    const app = await openApp({ page: 'cms' });
    await app.user.click(
      within(await screen.findByRole('region', { name: 'Əsas bölmə' })).getByRole('button', {
        name: 'Önizlə',
      }),
    );
    await screen.findByRole('dialog', { name: 'Saytın önizləməsi' });
    await expectNoViolations(app);
  });

  it('has no violations on the users', SCAN, async () => {
    const app = await openApp({ page: 'users' });
    await screen.findByRole('heading', { name: 'Panel istifadəçiləri' });
    await expectNoViolations(app);
  });

  it('has no violations with the menu of a phone open', SCAN, async () => {
    const app = await openApp({ width: 390 });
    await app.user.click(screen.getByRole('button', { name: 'Menyunu aç' }));
    await expectNoViolations(app);
  });

  it('has no violations with a message in the corner', SCAN, async () => {
    const app = await openApp({ page: 'reg' });
    await app.user.click(await screen.findByRole('button', { name: 'Aysel Test' }));
    await app.user.click(await screen.findByRole('button', { name: 'Əlaqə saxlanılıb' }));
    await screen.findByText('Status yeniləndi');
    await expectNoViolations(app);
  });
});
