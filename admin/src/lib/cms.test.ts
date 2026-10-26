import { describe, expect, it } from 'vitest';
import { makeContent } from '../test/fixtures.ts';
import {
  NOT_SAVED,
  PUBLISHED,
  WAITING,
  blankItem,
  changesToSave,
  fieldsOf,
  isDirty,
  labelFinder,
  lookOf,
  sameValue,
  savedValue,
  sectionState,
  sectionSummary,
  shownValue,
  uploadedPicture,
  valueToSave,
} from './cms.ts';

const content = makeContent();
const title = content.fields[0]!;
const faq = content.fields.find((field) => field.key === 'faq.items')!;

describe('values of the places', () => {
  it('shows the saved draft, or the page own text where nothing was saved', () => {
    expect(savedValue(title)).toBe('Kiçik ideyalar.');
    expect(savedValue({ ...title, draft: 'Yeni' })).toBe('Yeni');
  });

  it('compares lines, lists and items by what they hold', () => {
    expect(sameValue('a', 'a')).toBe(true);
    expect(sameValue(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameValue(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameValue([{ q: '1', a: '2' }], [{ q: '1', a: '2' }])).toBe(true);
  });

  it('shows a local change before the saved value', () => {
    expect(shownValue(title, {})).toBe('Kiçik ideyalar.');
    expect(shownValue(title, { [title.key]: 'Mənim' })).toBe('Mənim');
  });

  it('is changed only when the local value differs from the saved one', () => {
    expect(isDirty(title, {})).toBe(false);
    expect(isDirty(title, { [title.key]: 'Mənim' })).toBe(true);
    expect(isDirty(title, { [title.key]: 'Kiçik ideyalar.' })).toBe(false);
  });

  it('sends null for a value that is the page own text, so the place goes back to its default', () => {
    expect(valueToSave(title, 'Kiçik ideyalar.')).toBeNull();
    expect(valueToSave(title, 'Mənim')).toBe('Mənim');
    expect(valueToSave(faq, faq.default)).toBeNull();
  });

  it('collects the changed places of some fields for saving', () => {
    const edits = { [title.key]: 'Mənim', 'hero.subtitle': content.fields[1]!.default };
    expect(changesToSave(fieldsOf(content, 'hero'), edits)).toEqual({ 'hero.title_first': 'Mənim' });
    expect(changesToSave(fieldsOf(content, 'faq'), edits)).toEqual({});
  });
});

describe('the state of a section', () => {
  it('is not saved, waiting for publication, or published', () => {
    const fields = fieldsOf(content, 'hero');
    expect(lookOf(sectionState(fields, { [title.key]: 'Mənim' }))).toBe(NOT_SAVED);
    expect(
      lookOf(
        sectionState(
          fields.map((f) => ({ ...f, changed: true })),
          {},
        ),
      ),
    ).toBe(WAITING);
    expect(lookOf(sectionState(fields, {}))).toBe(PUBLISHED);
    expect(lookOf({ dirty: true, pending: true })).toBe(NOT_SAVED);
  });

  it('lists the fields of one section', () => {
    expect(fieldsOf(content, 'hero').map((field) => field.key)).toEqual([
      'hero.title_first',
      'hero.subtitle',
      'hero.primary_cta',
    ]);
  });

  it('reminds what a section holds with the labels of its first places', () => {
    expect(sectionSummary(fieldsOf(content, 'hero'))).toBe(
      'Başlıq, 1-ci sətir, Alt başlıq, Əsas düymənin yazısı',
    );
  });
});

describe('pictures and items', () => {
  it('knows an uploaded picture by its id and a built-in one by its path', () => {
    expect(uploadedPicture('00000000-0000-4000-8000-000000000001')).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(uploadedPicture('00000000-0000-4000-8000-00000000000A')).toBe(
      '00000000-0000-4000-8000-00000000000a',
    );
    expect(uploadedPicture('/assets/babek.jpeg')).toBeNull();
    expect(uploadedPicture(['x'])).toBeNull();
    expect(uploadedPicture(null)).toBeNull();
  });

  // The id goes into a CSS url("/media/<id>.webp") and into nothing else: whatever is not exactly an id is refused.
  it.each([
    ['a quote that closes the url', '00000000-0000-4000-8000-000000000001") ; background: red; ("'],
    ['a path out of the media folder', '../../etc/passwd'],
    ['an id with something after it', '00000000-0000-4000-8000-000000000001/../x'],
    ['an id with a line break after it', '00000000-0000-4000-8000-000000000001\n'],
    ['an id with a space', ' 00000000-0000-4000-8000-000000000001'],
    ['an id with a query', '00000000-0000-4000-8000-000000000001?x=1'],
    ['an address of another site', 'https://evil.example/x.png'],
    ['a javascript address', 'javascript:alert(1)'],
    ['a data address', 'data:image/svg+xml;base64,PHN2Zz4='],
    ['an id with a letter that is not hexadecimal', '0000000g-0000-4000-8000-000000000001'],
    ['an id that is too short', '00000000-0000-4000-8000-00000000000'],
    ['an empty text', ''],
  ])('does not take %s for a picture', (_what, hostile) => {
    expect(uploadedPicture(hostile)).toBeNull();
  });

  it('makes an empty item with a part for each part of the list', () => {
    expect(blankItem(faq)).toEqual({ q: '', a: '' });
    expect(
      blankItem({
        ...faq,
        item: [
          ...faq.item,
          { name: 'topics', label: 'Mövzular', kind: 'strings', max_length: 100, max_items: 6 },
        ],
      }),
    ).toEqual({ q: '', a: '', topics: [] });
  });

  it('finds the label of the place an error names, parts of items included', () => {
    const find = labelFinder(content);
    expect(find('hero.title_first')).toBe('Başlıq, 1-ci sətir');
    expect(find('faq.items.q')).toBe('Suallar');
    expect(find('nothing.here')).toBeUndefined();
    expect(labelFinder(null)('hero.title_first')).toBeUndefined();
  });
});
