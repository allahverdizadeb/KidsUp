import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_NAMES } from '../lib/figures';
import registryFile from './registry.json';
import { acceptValue, REGISTRY, registryField, type RegistryField } from './registry';

const BACK_REGISTRY = resolve(import.meta.dirname, '../../../back/app/panel/content_registry.json');
const THIS_REGISTRY = resolve(import.meta.dirname, './registry.json');
const PICTURE = '/media/00000000-0000-4000-8000-000000000001.webp';

describe('the content registry', () => {
  it('is the same file as the one the admin panel is built on (back/ owns it)', () => {
    expect(readFileSync(THIS_REGISTRY, 'utf-8')).toBe(readFileSync(BACK_REGISTRY, 'utf-8'));
  });

  it('lists every place once', () => {
    expect(REGISTRY.size).toBe(registryFile.fields.length);
  });

  it('only uses names in braces that the page knows how to fill in', () => {
    const names = new Set<string>(PLACEHOLDER_NAMES);
    const used = [...JSON.stringify(registryFile.fields).matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]);

    expect(used.length).toBeGreaterThan(5);
    expect(used.filter((name) => !names.has(name))).toEqual([]);
  });

  it('refuses an unknown place instead of showing nothing', () => {
    expect(() => registryField('hero.nothing')).toThrow('No place on the page is called hero.nothing.');
    expect(registryField('hero.title_first').defaultValue).toBe('Kiçik ideyalar.');
  });
});

describe('acceptValue (what the page takes from the published file)', () => {
  const accepts = (key: string, value: unknown) => acceptValue(registryField(key), value) !== undefined;

  it.each(['A text', 'x'.repeat(5000)])('takes a text of any ordinary length', (text) => {
    expect(accepts('hero.title_first', text)).toBe(true);
  });

  it.each([5, null, undefined, '', ['a'], { a: 1 }, 'x'.repeat(5001)])('refuses %j as a text', (value) => {
    expect(accepts('hero.title_first', value)).toBe(false);
  });

  it.each([
    'https://www.linkedin.com/in/someone/',
    '/assets/KidsUp-Brosura.pdf',
    '#qiymet',
    'tel:+994509988707',
    '/',
  ])('takes the link %s', (link) => {
    expect(accepts('founder.linkedin', link)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'data:text/html,hello',
    'http://example.com',
    '//evil.example.com',
    'https://user:secret@example.com',
    '/a b',
    'https://example.com/a b',
    '/back\\slash',
    'vbscript:x',
    'HTTPS://www.linkedin.com/in/someone/', // the panel refuses a scheme that is not in lower case too
    'https://www.linkedin.com/?m=a@b',
    'https://www.linkedin.com@evil.example/x',
    'https://evil.example/in/someone',
    'https://www.linkedin.com.evil.example/in/someone',
    'https://linkedin.com/in/someone',
    'https://www.linkedin.com:8443@evil.example/',
    'https://[www.linkedin.com',
  ])('refuses the link %s', (link) => {
    expect(accepts('founder.linkedin', link)).toBe(false);
  });

  it('lets each link point only where its place says (a place that names no host, none)', () => {
    expect(accepts('wharton.link', 'https://www.credential.net/abc-123')).toBe(true);
    expect(accepts('wharton.link', 'https://www.linkedin.com/in/someone/')).toBe(false);
    expect(accepts('brochure.file', '/assets/KidsUp-Brosura.pdf')).toBe(true);
    expect(accepts('brochure.file', 'https://evil.example/KidsUp-Brosura.pdf')).toBe(false);
    expect(accepts('brochure.file', 'https://www.credential.net/abc-123')).toBe(false);
  });

  it('lets a link place that names no host point to any https address (no place is like that today)', () => {
    const open: RegistryField = {
      key: 'x.link',
      kind: 'link',
      defaultValue: '/',
      parts: [],
      minItems: 0,
      maxItems: Infinity,
      hosts: undefined,
    };

    expect(acceptValue(open, 'https://anything.example/page')).toBe('https://anything.example/page');
    expect(acceptValue(open, 'http://anything.example/page')).toBeUndefined();
    expect(acceptValue(open, 'https://user@anything.example/')).toBeUndefined();
  });

  it.each(['+994 50 998 87 07', '+994509988707', '+1 (555) 123-4567'])(
    'takes the phone number %s',
    (phone) => {
      expect(accepts('contact.phone', phone)).toBe(true);
    },
  );

  it.each([
    '0509988707', // no country code: `tel:+0509988707` dials nothing
    '(012) 345-67-89',
    '+',
    '+994',
    'message/x?',
    '+994 50 998 87 07 ext 5',
    '+994\n509988707',
  ])('refuses the phone number %j', (phone) => {
    expect(accepts('contact.phone', phone)).toBe(false);
  });

  it.each(['994509988707', '12025550123'])('takes the WhatsApp number %s', (number) => {
    expect(accepts('contact.whatsapp', number)).toBe(true);
  });

  it.each([
    '0509988707', // no country code: it would address an unrelated account
    '509988707',
    '+994509988707',
    '994 50 998 87 07',
    'message/x?',
    '9945099887071234567', // too long
  ])('refuses the WhatsApp number %s (the page builds https://wa.me/<number> from it)', (number) => {
    expect(accepts('contact.whatsapp', number)).toBe(false);
  });

  it.each([PICTURE, '/assets/babek.jpeg'])('takes the picture %s', (picture) => {
    expect(accepts('founder.photo', picture)).toBe(true);
  });

  it.each([
    'https://evil.example/x.png',
    '//evil.example/x.png',
    '/media/../../etc/passwd',
    '/media/not-an-id.webp',
    `${PICTURE}?x=1`,
    'data:image/png;base64,AAAA',
    '/assets/a/b.png',
  ])('refuses the picture %s', (picture) => {
    expect(accepts('founder.photo', picture)).toBe(false);
  });

  it('takes a list of lines of the right length and nothing else', () => {
    const lines = ['a', 'b', 'c'];

    expect(accepts('demo_day.items', lines)).toBe(true);
    expect(accepts('demo_day.items', [])).toBe(false); // at least one
    expect(accepts('demo_day.items', ['a', 5])).toBe(false);
    expect(accepts('demo_day.items', 'a')).toBe(false);
  });

  it('takes a list of items whose parts are all there and of the right kind', () => {
    expect(accepts('faq.items', [{ q: 'Why?', a: 'Because.' }])).toBe(true);
    expect(accepts('faq.items', [])).toBe(false);
    expect(accepts('faq.items', [{ q: 'Why?' }])).toBe(false);
    expect(accepts('faq.items', [{ q: 'Why?', a: 5 }])).toBe(false);
    expect(accepts('faq.items', ['not an item'])).toBe(false);
    expect(accepts('faq.items', { q: 'Why?', a: 'Because.' })).toBe(false);
  });

  it('keeps the exact number of steps that have an illustration each', () => {
    const lesson = { time: '09:30–09:45', title: 'Qarşılama', desc: 'Oyun.' };
    const module = { week: '1-ci həftə', title: 'T', desc: 'D', topics: ['a', 'b', 'c'] };

    expect(
      accepts(
        'lesson.items',
        Array.from({ length: 8 }, () => lesson),
      ),
    ).toBe(true);
    expect(
      accepts(
        'lesson.items',
        Array.from({ length: 7 }, () => lesson),
      ),
    ).toBe(false);
    expect(
      accepts(
        'lesson.items',
        Array.from({ length: 9 }, () => lesson),
      ),
    ).toBe(false);
    expect(
      accepts(
        'modules.items',
        Array.from({ length: 6 }, () => module),
      ),
    ).toBe(true);
    expect(
      accepts(
        'modules.items',
        Array.from({ length: 5 }, () => module),
      ),
    ).toBe(false);
    expect(
      accepts('modules.items', [{ ...module, topics: 'a' }, ...Array.from({ length: 5 }, () => module)]),
    ).toBe(false);
  });
});
