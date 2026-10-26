import { act, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { openApp } from '../test/app.tsx';
import { ago, makeApplication } from '../test/fixtures.ts';

/** Only the timer that drives the polling is faked: the rest of the page keeps its real clock. */
const faked = () => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
const poll = () =>
  act(async () => {
    vi.advanceTimersByTime(15_000);
  });

describe('news of new applications', () => {
  it('looks every fifteen seconds, as a background poll that does not keep an idle session alive', async () => {
    faked();
    const { backend } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    const before = backend.called('GET', '/applications/pulse').length;

    await poll();

    await waitFor(() => expect(backend.called('GET', '/applications/pulse').length).toBe(before + 1));
    expect(
      backend
        .called('GET', '/applications/pulse')
        .every((request) => request.headers['x-background'] === 'poll'),
    ).toBe(true);
  });

  it('announces an application that arrived, and shows it without a reload', async () => {
    faked();
    const { backend } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    backend.applications.push(
      makeApplication('fresh', { parent_name: 'Yeni Gələn Ailə', created_at: ago(0) }),
    );

    await poll();

    expect(await screen.findByText('Yeni müraciət gəldi')).toBeInTheDocument();
    expect(await screen.findByText('Yeni Gələn Ailə')).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Admin menyu' })).getByRole('button', {
        name: 'Qeydiyyatlar, 3 yeni müraciət',
      }),
    ).toBeInTheDocument();
  });

  it('counts several that arrived together', async () => {
    faked();
    const { backend } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    backend.applications.push(
      makeApplication('a', { created_at: ago(1) }),
      makeApplication('b', { created_at: ago(0) }),
    );

    await poll();

    expect(await screen.findByText('2 yeni müraciət gəldi')).toBeInTheDocument();
  });

  it('refreshes the lists when somebody else changed one, without announcing news', async () => {
    faked();
    const { backend } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    backend.application('app-1').status = 'declined';

    await poll();

    await waitFor(() =>
      expect(
        within(within(screen.getByRole('table')).getAllByRole('row')[1]!).getByText('İmtina edilib'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/gəldi/)).not.toBeInTheDocument();
  });

  it('does not announce a change this screen made itself', async () => {
    faked();
    const { user } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Aysel Test' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Müraciət detalları' }));

    await user.click(await sheet.findByRole('button', { name: 'Əlaqə saxlanılıb' }));
    await screen.findByText('Status yeniləndi');
    await poll();

    expect(screen.queryByText(/gəldi/)).not.toBeInTheDocument();
  });

  it('leaves the screen when the poll finds the session over', async () => {
    faked();
    const { backend } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    backend.signedIn = false;

    await poll();

    expect(await screen.findByRole('heading', { name: 'Sessiya başa çatdı' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shrugs off a poll that fails and tries again at the next turn', async () => {
    faked();
    const { backend } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    backend.failNext('GET', '/applications/pulse', 500);
    backend.applications.push(makeApplication('later', { created_at: ago(0) }));

    await poll();
    expect(screen.queryByText('Yeni müraciət gəldi')).not.toBeInTheDocument();
    await poll();

    expect(await screen.findByText('Yeni müraciət gəldi')).toBeInTheDocument();
  });

  it('stops looking when the screen is closed', async () => {
    faked();
    const { backend, unmount } = await openApp({ page: 'reg' });
    await screen.findByRole('table');
    unmount();
    const before = backend.called('GET', '/applications/pulse').length;

    await poll();

    expect(backend.called('GET', '/applications/pulse')).toHaveLength(before);
  });
});
