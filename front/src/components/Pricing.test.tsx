import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Pricing from './Pricing';
import ProgramStats from './ProgramStats';

describe('Pricing', () => {
  it('states the price, the family discount and the programme facts consistently', () => {
    render(<Pricing />);
    expect(screen.getByText('650')).toBeInTheDocument();
    expect(screen.getByText(/ikinci uşaq üçün qiymət/)).toHaveTextContent('500 AZN');
    expect(screen.getByText('1 300 AZN')).toHaveStyle({ textDecoration: 'line-through' });
    expect(screen.getByText('1 150 AZN')).toBeInTheDocument();
    expect(screen.getByText('150 AZN qənaət — 11,5% ailə endirimi')).toBeInTheDocument();
    expect(screen.getByText('5 dekabr 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Müraciət et' })).toHaveAttribute('href', '#muraciet');
  });
});

describe('ProgramStats', () => {
  it('summarises the programme in four numbers', () => {
    render(<ProgramStats />);
    expect(screen.getByText('həftə').previousSibling).toHaveTextContent('6');
    expect(screen.getByText('modul').previousSibling).toHaveTextContent('6');
    expect(screen.getByText('dərs mövzusu').previousSibling).toHaveTextContent('16');
    expect(screen.getByText('oyun və praktika').previousSibling).toHaveTextContent('60%');
  });
});
