import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Hero from './Hero';

const stepLabel = (name: string) => screen.getByText(name);

describe('Hero', () => {
  it('presents the programme headline and key facts', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kiçik ideyalar.Böyük başlanğıclar.');
    const facts = screen.getByRole('list', { name: 'Əsas məlumatlar' });
    expect(facts).toHaveTextContent('8–13 yaş');
    expect(facts).toHaveTextContent('Başlanğıc: 5 dekabr 2026');
    expect(screen.getByRole('link', { name: 'Proqramla tanış ol' })).toHaveAttribute('href', '#proqram');
  });

  it('highlights a step while the mouse is over it, and only for mouse pointers', () => {
    render(<Hero />);
    const step = stepLabel('Sına');
    expect(step).toHaveStyle({ color: '#1A1A1A' });

    fireEvent.pointerOver(step.parentElement as HTMLElement, { pointerType: 'touch' });
    expect(step).toHaveStyle({ color: '#1A1A1A' });

    fireEvent.pointerOver(step.parentElement as HTMLElement, { pointerType: 'mouse' });
    expect(step).toHaveStyle({ color: '#FF0083' });

    fireEvent.pointerOut(step.parentElement as HTMLElement, { pointerType: 'mouse' });
    expect(step).toHaveStyle({ color: '#1A1A1A' });
  });

  it('lights up the step matching the part of the illustration under the pointer', () => {
    render(<Hero />);
    const scene = screen.getByRole('img', { name: /dörd uşaq/ });
    scene.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect;

    fireEvent.pointerMove(scene, { pointerType: 'mouse', clientX: 100 });
    expect(stepLabel('Birlikdə hazırla')).toHaveStyle({ color: '#FF0083' });

    fireEvent.pointerMove(scene, { pointerType: 'mouse', clientX: 400 });
    expect(stepLabel('İdeya yarat')).toHaveStyle({ color: '#FF0083' });

    fireEvent.pointerMove(scene, { pointerType: 'mouse', clientX: 600 });
    expect(stepLabel('Sına')).toHaveStyle({ color: '#FF0083' });

    fireEvent.pointerMove(scene, { pointerType: 'mouse', clientX: 900 });
    expect(stepLabel('Təqdim et')).toHaveStyle({ color: '#FF0083' });

    fireEvent.pointerLeave(scene, { pointerType: 'mouse' });
    expect(stepLabel('Təqdim et')).toHaveStyle({ color: '#1A1A1A' });
  });

  it('ignores touch movement over the illustration', () => {
    render(<Hero />);
    const scene = screen.getByRole('img', { name: /dörd uşaq/ });
    scene.getBoundingClientRect = () => ({ left: 0, width: 1000 }) as DOMRect;
    fireEvent.pointerMove(scene, { pointerType: 'touch', clientX: 100 });
    expect(stepLabel('Birlikdə hazırla')).toHaveStyle({ color: '#1A1A1A' });
  });
});
