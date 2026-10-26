import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from '../App.tsx';
import { CODE, FakeBackend, PASSWORD } from './fakeBackend.ts';
import type { FakeOptions } from './fakeBackend.ts';
import { profile } from './fixtures.ts';

export function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
}

export interface Opened extends ReturnType<typeof render> {
  backend: FakeBackend;
  user: ReturnType<typeof userEvent.setup>;
}

/** Start the panel against a fake API. Signed in by default; the page can be chosen with `page` (the # of the address). */
export async function openApp(
  options: FakeOptions & { width?: number; page?: string } = {},
): Promise<Opened> {
  const backend = new FakeBackend(options);
  vi.stubGlobal('fetch', backend.fetch);
  setViewportWidth(options.width ?? 1440);
  window.location.hash = options.page ?? '';
  const user = userEvent.setup({ delay: null });
  const view = render(<App />);
  if (backend.signedIn) await screen.findByRole('navigation', { name: 'Admin menyu' });
  else await screen.findByRole('button', { name: 'Daxil ol' });
  // What was just drawn starts its timers and listeners a moment later; the test goes on only when they are running.
  await act(async () => undefined);
  return { ...view, backend, user };
}

/** Fill in the sign-in form with the right (or given) answers and send it. */
export async function signInThroughForm(
  user: Opened['user'],
  role: Parameters<typeof profile>[0] = 'admin',
  answers: { password?: string; code?: string } = {},
) {
  await user.type(screen.getByLabelText('E-poçt'), profile(role).email);
  await user.type(screen.getByLabelText('Şifrə'), answers.password ?? PASSWORD);
  await user.type(screen.getByLabelText('Birdəfəlik kod'), answers.code ?? CODE);
  await user.click(screen.getByRole('button', { name: 'Daxil ol' }));
}
