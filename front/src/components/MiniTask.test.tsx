import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import MiniTask from './MiniTask';

describe('MiniTask', () => {
  it('asks the child to pick a direction first', () => {
    render(<MiniTask />);
    expect(screen.getByText(/Üç istiqamətdən birini seçin/)).toBeInTheDocument();
    for (const option of screen.getAllByRole('button'))
      expect(option).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows guidance for the chosen direction and marks it as viewed', async () => {
    render(<MiniTask />);
    await userEvent.click(screen.getByRole('button', { name: /İnsanlardan soruş/ }));
    expect(screen.getByText('Əvvəlcə problemi daha yaxşı anlayaq.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /İnsanlardan soruş/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: /İdeyanı çək/ }));
    expect(screen.getByText(/Bir neçə həll düşün/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /İnsanlardan soruş.*baxılıb/ })).toBeInTheDocument();
  });

  it('shows the summary only after all three directions were explored', async () => {
    render(<MiniTask />);
    const summary = /bu yanaşmanı praktiki tapşırıqlarla məşq edirlər/;
    await userEvent.click(screen.getByRole('button', { name: /İnsanlardan soruş/ }));
    await userEvent.click(screen.getByRole('button', { name: /İdeyanı çək/ }));
    expect(screen.queryByText(summary)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Nümunə hazırla/ }));
    expect(screen.getByText(/Kağız və ya kartonla sadə bir nümunə/)).toBeInTheDocument();
    expect(screen.getByText(summary)).toBeInTheDocument();
  });

  it('does not double count a direction that is picked twice', async () => {
    render(<MiniTask />);
    const option = screen.getByRole('button', { name: /İdeyanı çək/ });
    await userEvent.click(option);
    await userEvent.click(option);
    expect(screen.queryByText(/məşq edirlər/)).not.toBeInTheDocument();
  });
});
