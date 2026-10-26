import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from '../test/app.tsx';
import type { Opened } from '../test/app.tsx';
import { NOW } from '../test/fixtures.ts';

async function open(options: Parameters<typeof openApp>[0] = {}): Promise<Opened> {
  // The screen says "1 saat əvvəl" against the clock of the day; the test fixes that clock.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(NOW));
  const app = await openApp({ page: 'users', ...options });
  await screen.findByRole('heading', { name: 'İstifadəçilər', level: 1 });
  await screen.findByRole('heading', { name: 'Panel istifadəçiləri' });
  return app;
}

const people = () => within(screen.getByRole('region', { name: 'Panel istifadəçiləri' }));
const roleCard = (name: string) => within(screen.getByRole('region', { name }));

describe('who has access', () => {
  it('lists the accounts with their role, state and last sign-in', async () => {
    await open();

    const rows = people().getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText('Test Admin')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('admin@example.test')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Aktiv')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('1 saat əvvəl')).toBeInTheDocument();
    expect(within(rows[0]!).getByText('Admin')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Menecer')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('1 gün əvvəl')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Müşahidəçi')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Deaktiv')).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Hələ daxil olmayıb')).toBeInTheDocument();
  });

  it('marks the account of whoever looks', async () => {
    await open();

    const rows = people().getAllByRole('listitem');
    expect(within(rows[0]!).getByText('Siz')).toBeInTheDocument();
    expect(within(rows[1]!).queryByText('Siz')).not.toBeInTheDocument();
  });

  it('counts the accounts of each role and says what each may do', async () => {
    await open();

    const roles = [
      ['Admin', '1', /Tam giriş: müraciətlər, kurslar, sayt məzmunu, ixrac və silmə/],
      ['Menecer', '1', /Müraciətlərə baxır, statusu dəyişir və qeyd yazır/],
      ['Müşahidəçi', '1', /Yalnız baxış/],
    ] as const;
    for (const [name, count, description] of roles) {
      const card = roleCard(name);
      expect(card.getByText(count)).toBeInTheDocument();
      expect(card.getByText(description)).toBeInTheDocument();
    }
    expect(screen.getByText('3 istifadəçi · 1 deaktiv')).toBeInTheDocument();
  });

  it('cannot add, change or remove anybody: those are done on the server', async () => {
    await open();

    expect(screen.queryByRole('button', { name: /İstifadəçi əlavə et/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText(/serverdə əmrlə edilir/)).toBeInTheDocument();
    expect(screen.getByText(/app\.panel\.cli/)).toBeInTheDocument();
  });

  it('asks the API once, and shows nothing secret', async () => {
    const { backend, container } = await open();

    expect(backend.called('GET', '/users')).toHaveLength(1);
    expect(container.textContent).not.toMatch(/argon2|totp|password_hash/i);
  });

  it('is not in the menu for a role that may not see it, and not opened by the address', async () => {
    await openApp({ role: 'coordinator', page: 'users' });

    expect(await screen.findByRole('heading', { name: /yeni müraciət/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'İstifadəçilər' })).not.toBeInTheDocument();
  });

  it('offers to try again when the list cannot be loaded', async () => {
    const { user, backend } = await openApp({ page: 'dash' });
    await screen.findByRole('heading', { name: /yeni müraciət/ });
    backend.failNext('GET', '/users', 500);
    await user.click(screen.getByRole('button', { name: 'İstifadəçilər' }));

    await user.click(await screen.findByRole('button', { name: 'Yenidən cəhd et' }));

    await waitFor(() => expect(people().getAllByRole('listitem')).toHaveLength(3));
  });

  it('shows the cards one under the other on a narrow screen', async () => {
    await open({ width: 600 });

    expect(people().getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByText('1 saat əvvəl')).not.toBeInTheDocument(); // the last sign-in column needs room
  });
});
