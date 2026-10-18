import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LESSONS } from '../content/lessons';
import { setViewportWidth } from '../test/viewport';
import Lesson from './Lesson';

describe('Lesson', () => {
  it('starts on the first stage of the lesson', () => {
    setViewportWidth(1440);
    render(<Lesson />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(LESSONS[0].title);
    expect(status).toHaveTextContent(LESSONS[0].desc);
  });

  it('lists every stage in a timeline on wide screens and switches on click', async () => {
    setViewportWidth(1440);
    render(<Lesson />);
    const steps = screen.getAllByRole('button');
    expect(steps).toHaveLength(LESSONS.length);

    await userEvent.click(steps[4]);
    expect(steps[4]).toHaveAttribute('aria-current', 'step');
    expect(steps[0]).not.toHaveAttribute('aria-current', 'step');
    expect(within(screen.getByRole('status')).getByText('Praktiki iş')).toBeInTheDocument();
  });

  it('uses a compact grid of start times on narrow screens', async () => {
    setViewportWidth(500);
    render(<Lesson />);
    const group = screen.getByRole('group', { name: 'Dərsin mərhələləri' });
    const steps = within(group).getAllByRole('button');
    expect(steps).toHaveLength(LESSONS.length);
    expect(steps[2]).toHaveAccessibleName('3. 10:15–10:45 Komanda oyunu');

    await userEvent.click(steps[2]);
    expect(screen.getByRole('status')).toHaveTextContent('Komanda oyunu');
  });
});
