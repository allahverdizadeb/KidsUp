import { render } from '@testing-library/react';
import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import App from './App';
import { setViewportWidth } from './test/viewport';

// jsdom has no layout, so axe's colour-contrast rule cannot run here; contrast is checked against the design
// tokens in docs/styling-and-accessibility-standards.md and manually in a real browser before release.
const rules = { 'color-contrast': { enabled: false } };

async function violationsFor(width: number) {
  setViewportWidth(width);
  const { container } = render(<App />);
  const result = await axe.run(container, {
    rules,
    runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'],
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0].html.slice(0, 120)}`,
  );
}

// Scanning the whole page is CPU-heavy (more so with coverage instrumentation), so give it ample time.
const SCAN_TIMEOUT_MS = 60_000;

describe('accessibility (axe, WCAG 2.2 AA + best practice)', () => {
  it('has no violations on desktop', { timeout: SCAN_TIMEOUT_MS }, async () => {
    expect(await violationsFor(1440)).toEqual([]);
  });

  it('has no violations on mobile', { timeout: SCAN_TIMEOUT_MS }, async () => {
    expect(await violationsFor(390)).toEqual([]);
  });
});
