import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FAQ } from '../content/faq';
import Faq from './Faq';

describe('Faq', () => {
  it('opens the first question by default', () => {
    render(<Faq />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(FAQ.length);
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Bəli\. Öz fikrini ifadə etmək/)).toBeInTheDocument();
  });

  it('keeps a single answer open and allows closing it', async () => {
    render(<Faq />);
    const buttons = screen.getAllByRole('button');
    await userEvent.click(buttons[2]);
    expect(buttons[2]).toHaveAttribute('aria-expanded', 'true');
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(buttons[2]);
    expect(buttons[2]).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders **marked** parts of an answer in bold', async () => {
    render(<Faq />);
    await userEvent.click(screen.getAllByRole('button')[FAQ.length - 1]);
    const bold = screen.getByText('1 150 AZN');
    expect(bold).toHaveStyle({ fontWeight: '800' });
  });
});
