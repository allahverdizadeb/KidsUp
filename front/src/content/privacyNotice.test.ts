import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CONSENT_LABEL,
  PRIVACY_NOTICE,
  PRIVACY_NOTICE_ANCHOR,
  PRIVACY_NOTICE_VERSION,
} from './privacyNotice';

// SHA-256 of the wording each version of the notice was shown with. A new wording needs a new version (and a new
// line here, and the version added to PUBLISHED_NOTICE_VERSIONS in back/app/schemas/application.py): the version is
// stored with every application, so it must always say which text the parent agreed to.
const SHOWN_WORDING = {
  '2026-10-19-draft': '310bd39e1f665903efc98b6b2299796483ff688193efd28b84ffc045893ea5ae',
} as const satisfies Record<string, string>;

function fingerprintOfWording(): string {
  return createHash('sha256')
    .update(JSON.stringify({ label: CONSENT_LABEL, notice: PRIVACY_NOTICE }))
    .digest('hex');
}

describe('privacy notice content (SEC-F-16)', () => {
  it('has a version the API accepts', () => {
    // The pattern of NoticeVersion in back/app/schemas/application.py.
    expect(PRIVACY_NOTICE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}(-[a-z0-9]{1,16})?$/);
    expect(PRIVACY_NOTICE_VERSION.length).toBeLessThanOrEqual(32);
  });

  it('has a version that starts with a real date', () => {
    const date = new Date(`${PRIVACY_NOTICE_VERSION.slice(0, 10)}T00:00:00Z`);
    expect(date.toISOString().slice(0, 10)).toBe(PRIVACY_NOTICE_VERSION.slice(0, 10));
  });

  it('shows, under the current version, exactly the wording that was recorded for it', () => {
    const recorded = (SHOWN_WORDING as Record<string, string>)[PRIVACY_NOTICE_VERSION];
    expect(recorded, `no wording recorded for ${PRIVACY_NOTICE_VERSION}`).toBeDefined();
    expect(
      fingerprintOfWording(),
      'The notice or the consent label changed: bump PRIVACY_NOTICE_VERSION, add it to the API, record the new fingerprint',
    ).toBe(recorded);
  });

  it('answers what SEC-F-16 requires: who collects, why, how long, who sees, deletion and a contact', () => {
    const headings = PRIVACY_NOTICE.map(({ heading }) => heading).join(' | ');
    for (const topic of [/kim idarə/, /Nə üçün/, /Nə qədər saxlan/, /kimlərin çıxışı/, /Hüquqlarınız/]) {
      expect(headings).toMatch(topic);
    }
    expect(PRIVACY_NOTICE.some(({ text }) => text.includes('+994 50 998 87 07'))).toBe(true);
  });

  it('promises the retention period the API enforces at most (12 months, KIDSUP_RETENTION_DAYS <= 365)', () => {
    const retention = PRIVACY_NOTICE.find(({ heading }) => heading.startsWith('Nə qədər saxlan'));
    expect(retention?.text).toContain('ən geci 12 ay');
  });

  it('has an address fragment that is a valid, unique element id', () => {
    expect(PRIVACY_NOTICE_ANCHOR).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it('has no empty section and no duplicate heading', () => {
    const headings = PRIVACY_NOTICE.map(({ heading }) => heading);
    expect(new Set(headings).size).toBe(headings.length);
    for (const { heading, text } of PRIVACY_NOTICE) {
      expect(heading.trim(), 'empty heading').not.toBe('');
      expect(text.trim(), `empty text under "${heading}"`).not.toBe('');
    }
  });
});
