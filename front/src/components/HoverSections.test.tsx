import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Approach from './Approach';
import Brochure from './Brochure';
import DemoDay from './DemoDay';
import Skills from './Skills';

// Sections whose illustrations react to the mouse: each owns a set of hover ids.
const firstWithHandlers = (container: HTMLElement) =>
  container.querySelector('[style*="flex-direction: column"]');

describe('Skills', () => {
  it('lists the six skills the children learn', () => {
    render(<Skills />);
    expect(screen.getByText('Problemləri görmək və həll düşünmək')).toBeInTheDocument();
    expect(screen.getByText('Rəylə işini yaxşılaşdırmaq')).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(6);
  });

  it('animates the hovered skill illustration only', () => {
    render(<Skills />);
    const card = screen.getByText('Komandada işləmək').parentElement as HTMLElement;
    const tape = () => card.querySelector('path[style*="fill"]') as SVGPathElement;
    const resting = tape().style.fill;
    fireEvent.pointerOver(card, { pointerType: 'mouse' });
    expect(tape().style.fill).not.toBe(resting);
    fireEvent.pointerOut(card, { pointerType: 'mouse' });
    expect(tape().style.fill).toBe(resting);
  });
});

describe('Approach', () => {
  it('shows the three phases: idea, practice, money', () => {
    render(<Approach />);
    for (const heading of [
      'Hər şey bir sualdan başlayır.',
      'Özümüz hazırlayırıq, özümüz sınayırıq.',
      'İdeyanın hesabını da aparırıq.',
    ])
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('reacts to the mouse on each phase', () => {
    const { container } = render(<Approach />);
    const phases = Array.from(container.querySelectorAll('[data-reveal]'));
    expect(phases).toHaveLength(3);
    for (const phase of phases) {
      fireEvent.pointerOver(phase, { pointerType: 'mouse' });
      fireEvent.pointerOut(phase, { pointerType: 'mouse' });
    }
  });
});

describe('DemoDay', () => {
  it('lists what the children present', () => {
    render(<DemoDay />);
    expect(screen.getByText('Sadə maliyyə hesabı')).toBeInTheDocument();
    expect(screen.getByText('Proqramı uğurla tamamlama sertifikatı')).toBeInTheDocument();
  });

  it('reacts to the mouse over the scene', () => {
    const { container } = render(<DemoDay />);
    const scene = container.querySelector('svg')?.parentElement as HTMLElement;
    fireEvent.pointerOver(scene, { pointerType: 'mouse' });
    fireEvent.pointerOut(scene, { pointerType: 'mouse' });
    expect(firstWithHandlers(container)).toBeTruthy();
  });
});

describe('Brochure', () => {
  it('offers the PDF brochure as a download', () => {
    render(<Brochure />);
    const link = screen.getByRole('link', { name: /Broşuranı yüklə/ });
    expect(link).toHaveAttribute('href', '/assets/KidsUp-Brosura.pdf');
    expect(link).toHaveAttribute('download', 'KidsUp-Brosura.pdf');
  });

  it('reacts to the mouse over the card', () => {
    const { container } = render(<Brochure />);
    const card = container.querySelector('svg')?.closest('[style*="border"]') as HTMLElement;
    fireEvent.pointerOver(card, { pointerType: 'mouse' });
    fireEvent.pointerOut(card, { pointerType: 'mouse' });
  });
});
