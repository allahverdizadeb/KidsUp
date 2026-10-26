import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDrawer } from '../state/useDrawer.ts';
import { useLive } from '../state/useLive.ts';
import { useNav } from '../state/useNav.ts';
import { useAdmin, useSession } from '../state/useSession.ts';
import { useToast } from '../state/useToast.ts';
import { useAsync } from './useAsync.ts';
import { useDebounced } from './useDebounced.ts';
import { useOverlay } from './useOverlay.ts';
import { layoutOf, useWidth } from './useWidth.ts';

describe('the hooks of the state', () => {
  const hooks: [string, () => unknown][] = [
    ['useSession', useSession],
    ['useAdmin', useAdmin],
    ['useToast', useToast],
    ['useNav', useNav],
    ['useLive', useLive],
    ['useDrawer', useDrawer],
  ];

  it.each(hooks)('%s says so when its provider is missing', (_name, hook) => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => hook())).toThrow(/needs a/);
    quiet.mockRestore();
  });
});

describe('useWidth', () => {
  it('follows the window, and lays out as the design does', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
    const { result } = renderHook(() => useWidth());
    expect(result.current).toBe(1440);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 800 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(800);
    expect([1440, 1100, 1099, 760, 759, 390].map(layoutOf)).toEqual([
      'full',
      'full',
      'rail',
      'rail',
      'mobile',
      'mobile',
    ]);
  });
});

describe('useDebounced', () => {
  it('gives the value once it has stopped changing', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => useDebounced(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    rerender({ value: 'abc' });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('abc');
  });
});

describe('useAsync', () => {
  it('loads, keeps the answer, and loads again on request', async () => {
    let n = 0;
    const { result } = renderHook(() => useAsync(async () => ++n));
    expect(result.current.data).toBeNull();

    await act(async () => undefined);
    expect(result.current).toMatchObject({ data: 1, error: null });

    act(() => result.current.reload());
    await act(async () => undefined);
    expect(result.current.data).toBe(2);
  });

  it('keeps the old answer while the next is on its way, and reports a failure', async () => {
    const { result, rerender } = renderHook(
      ({ id }) =>
        useAsync(async () => {
          if (id === 2) throw new Error('no');
          return id;
        }, String(id)),
      { initialProps: { id: 1 } },
    );
    await act(async () => undefined);
    expect(result.current.data).toBe(1);

    rerender({ id: 2 });
    await act(async () => undefined);

    expect(result.current.data).toBe(1);
    expect((result.current.error as Error).message).toBe('no');
  });

  it('drops an answer that arrives after a newer request was made', async () => {
    const slow: { resolve: (value: string) => void }[] = [];
    const { result, rerender } = renderHook(
      ({ id }) =>
        useAsync(
          () => new Promise<string>((resolve) => slow.push({ resolve: (v) => resolve(`${id}:${v}`) })),
          String(id),
        ),
      { initialProps: { id: 1 } },
    );

    rerender({ id: 2 });
    await act(async () => {
      slow[1]!.resolve('new');
      slow[0]!.resolve('old'); // arrives last, belongs to the first request
    });

    expect(result.current.data).toBe('2:new');
  });

  it('lets a page set the data itself', async () => {
    const { result } = renderHook(() => useAsync(async () => 'loaded'));
    await act(async () => undefined);

    act(() => result.current.setData('set by the page'));

    expect(result.current.data).toBe('set by the page');
  });

  it('tells the loader when only the page refreshing itself asked for the run (a background run)', async () => {
    const seen: boolean[] = [];
    const { result, rerender } = renderHook(
      ({ key, refresh }) =>
        useAsync(
          async (background) => {
            seen.push(background);
            return key;
          },
          key,
          refresh,
        ),
      { initialProps: { key: 'a', refresh: 0 } },
    );
    await act(async () => undefined);

    rerender({ key: 'a', refresh: 1 }); // the news changed: the page updates itself
    await act(async () => undefined);
    rerender({ key: 'b', refresh: 1 }); // somebody changed the filter
    await act(async () => undefined);
    rerender({ key: 'c', refresh: 2 }); // both together: somebody is working
    await act(async () => undefined);
    act(() => result.current.reload()); // somebody pressed "try again"
    await act(async () => undefined);

    expect(seen).toEqual([false, true, false, false, false]);
  });
});

describe('useOverlay', () => {
  function Window({
    onClose,
    label,
    content = true,
  }: {
    onClose: () => void;
    label: string;
    content?: boolean;
  }) {
    const ref = useRef<HTMLDivElement>(null);
    useOverlay(true, onClose, ref);
    return (
      <div ref={ref} role="dialog" aria-label={label}>
        {content && (
          <>
            <button>{label} one</button>
            <button>{label} two</button>
          </>
        )}
      </div>
    );
  }

  function Opener({ content = true }: { content?: boolean }) {
    const [open, setOpen] = useState(false);
    const [inner, setInner] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>open</button>
        {open && <Window label="outer" content={content} onClose={() => setOpen(false)} />}
        {open && <button onClick={() => setInner(true)}>inside outer</button>}
        {inner && <Window label="inner" onClose={() => setInner(false)} />}
      </>
    );
  }

  it('moves the focus in, keeps Tab inside, and gives the focus back on closing', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Opener />);
    await user.click(screen.getByRole('button', { name: 'open' }));

    expect(screen.getByRole('button', { name: 'outer one' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'outer two' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'outer one' })).toHaveFocus(); // wrapped round
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'outer two' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'open' })).toHaveFocus();
  });

  it('locks the scrolling of the page while open', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Opener />);

    await user.click(screen.getByRole('button', { name: 'open' }));
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('lets Escape close only the window on top', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Opener />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    await user.click(screen.getByRole('button', { name: 'inside outer' }));
    expect(screen.getByRole('dialog', { name: 'inner' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'inner' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'outer' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('takes the focus itself when there is nothing to focus in the window, and does not let Tab leave', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Opener content={false} />);
    await user.click(screen.getByRole('button', { name: 'open' }));

    expect(screen.getByRole('dialog', { name: 'outer' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('dialog', { name: 'outer' })).toHaveFocus();
  });

  it('brings the focus back in when it got out', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Opener />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    act(() => screen.getByRole('button', { name: 'inside outer' }).focus()); // outside the window

    await user.tab();

    expect(screen.getByRole('button', { name: 'outer one' })).toHaveFocus();
  });
});
