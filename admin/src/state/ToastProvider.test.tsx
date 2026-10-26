import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ToastProvider from './ToastProvider.tsx';
import { useToast } from './useToast.ts';

function Buttons() {
  const { toast, clear } = useToast();
  return (
    <>
      <button onClick={() => toast('ok', 'Hazırdır', 'Yazıldı.')}>ok</button>
      <button onClick={() => toast('error', 'Alınmadı')}>error</button>
      <button onClick={() => toast('ok', `Mesaj ${Math.random()}`)}>many</button>
      <button onClick={clear}>clear</button>
    </>
  );
}

const open = () =>
  render(
    <ToastProvider>
      <Buttons />
    </ToastProvider>,
  );

const wait = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('the messages in the corner', () => {
  it('announces a message politely, and a failure as an alert', async () => {
    const user = userEvent.setup({ delay: null });
    open();

    await user.click(screen.getByRole('button', { name: 'ok' }));
    await user.click(screen.getByRole('button', { name: 'error' }));

    expect(screen.getByRole('status')).toHaveTextContent('Hazırdır');
    expect(screen.getByRole('status')).toHaveTextContent('Yazıldı.');
    expect(screen.getByRole('alert')).toHaveTextContent('Alınmadı');
  });

  it('lets a success go away by itself after a while, and not before', () => {
    vi.useFakeTimers();
    open();
    act(() => screen.getByRole('button', { name: 'ok' }).click());
    expect(screen.getByRole('status')).toBeInTheDocument();

    wait(5999);
    expect(screen.getByRole('status')).toBeInTheDocument();
    wait(1);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps a failure until it is closed (no time limit on something the person has to act on)', async () => {
    vi.useFakeTimers();
    open();
    act(() => screen.getByRole('button', { name: 'error' }).click());

    wait(10 * 60_000);

    expect(screen.getByRole('alert')).toHaveTextContent('Alınmadı');
    act(() => screen.getByRole('button', { name: 'Bağla' }).click());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('waits while the pointer is on a message, and then gives it the time that was left', () => {
    vi.useFakeTimers();
    open();
    act(() => screen.getByRole('button', { name: 'ok' }).click());
    wait(4000);

    fireEvent.pointerEnter(screen.getByRole('status'));
    wait(60_000);
    expect(screen.getByRole('status')).toBeInTheDocument();

    fireEvent.pointerLeave(screen.getByRole('status'));
    wait(1999);
    expect(screen.getByRole('status')).toBeInTheDocument();
    wait(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('waits while the keyboard focus is inside a message', () => {
    vi.useFakeTimers();
    open();
    act(() => screen.getByRole('button', { name: 'ok' }).click());

    act(() => screen.getByRole('button', { name: 'Bağla' }).focus());
    wait(60_000);
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => screen.getByRole('button', { name: 'Bağla' }).blur());
    wait(6000);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('goes away when closed', async () => {
    const user = userEvent.setup({ delay: null });
    open();
    await user.click(screen.getByRole('button', { name: 'ok' }));

    await user.click(screen.getByRole('button', { name: 'Bağla' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('takes every message away on request (the session is over)', async () => {
    const user = userEvent.setup({ delay: null });
    open();
    await user.click(screen.getByRole('button', { name: 'ok' }));
    await user.click(screen.getByRole('button', { name: 'error' }));

    await user.click(screen.getByRole('button', { name: 'clear' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the three newest at most', async () => {
    const user = userEvent.setup({ delay: null });
    open();

    for (let n = 0; n < 5; n += 1) await user.click(screen.getByRole('button', { name: 'many' }));

    expect(screen.getAllByRole('status')).toHaveLength(3);
  });

  it('lets the oldest success go before a failure that nobody has closed', async () => {
    const user = userEvent.setup({ delay: null });
    open();
    await user.click(screen.getByRole('button', { name: 'error' }));

    for (let n = 0; n < 4; n += 1) await user.click(screen.getByRole('button', { name: 'many' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Alınmadı');
    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('lets the oldest failure go only when every message is a failure', async () => {
    const user = userEvent.setup({ delay: null });
    open();

    for (let n = 0; n < 4; n += 1) await user.click(screen.getByRole('button', { name: 'error' }));

    expect(screen.getAllByRole('alert')).toHaveLength(3);
  });

  it('stretches over the width of a narrow screen', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    const user = userEvent.setup({ delay: null });
    open();
    await user.click(screen.getByRole('button', { name: 'ok' }));

    expect(screen.getByRole('status').parentElement).toHaveStyle({ left: '16px' });
  });
});
