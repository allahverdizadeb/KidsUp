import type { Content, ContentField, ContentValue, ItemValue } from '../api/types.ts';
import type { StatusLook } from './status.ts';

/** Local changes not yet saved, by the key of the place. */
export type Edits = Record<string, ContentValue>;

/** What a place shows now: the saved draft, or the page's own text where nothing was saved. */
export function savedValue(field: ContentField): ContentValue {
  return field.draft ?? field.default;
}

export function sameValue(a: ContentValue, b: ContentValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** What the editor shows: the local change if there is one, else the saved value. */
export function shownValue(field: ContentField, edits: Edits): ContentValue {
  return field.key in edits ? (edits[field.key] as ContentValue) : savedValue(field);
}

export function isDirty(field: ContentField, edits: Edits): boolean {
  return field.key in edits && !sameValue(edits[field.key] as ContentValue, savedValue(field));
}

/** A value that equals the page's own text is not a change to keep: the place goes back to its default (null). */
export function valueToSave(field: ContentField, value: ContentValue): ContentValue {
  return sameValue(value, field.default) ? null : value;
}

export interface SectionState {
  dirty: boolean;
  pending: boolean;
}

export function sectionState(fields: ContentField[], edits: Edits): SectionState {
  return {
    dirty: fields.some((field) => isDirty(field, edits)),
    pending: fields.some((field) => field.changed),
  };
}

export const NOT_SAVED: StatusLook = {
  label: 'Yadda saxlanmayıb',
  dot: '#F29900',
  fg: '#8F5400',
  bg: '#FFF4E2',
};
export const WAITING: StatusLook = { label: 'Dərc gözləyir', dot: '#FF0083', fg: '#C2006A', bg: '#FFEFF7' };
export const PUBLISHED: StatusLook = { label: 'Dərc olunub', dot: '#1F9D66', fg: '#0F6B43', bg: '#E8F6EE' };

export function lookOf(state: SectionState): StatusLook {
  if (state.dirty) return NOT_SAVED;
  return state.pending ? WAITING : PUBLISHED;
}

export function fieldsOf(content: Content, sectionId: string): ContentField[] {
  return content.fields.filter((field) => field.section === sectionId);
}

/** The values to send to save a set of places: only the ones that changed. */
export function changesToSave(fields: ContentField[], edits: Edits): Record<string, ContentValue> {
  const values: Record<string, ContentValue> = {};
  for (const field of fields) {
    if (isDirty(field, edits)) values[field.key] = valueToSave(field, edits[field.key] as ContentValue);
  }
  return values;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The id of an uploaded picture, if that is what the value is (a built-in picture is a path, not an id). */
export function uploadedPicture(value: ContentValue): string | null {
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : null;
}

/** The label of the place an error names; a part of an item (`lesson.items.title`) belongs to its place. */
export function labelFinder(content: Content | null): (key: string) => string | undefined {
  return (key) => {
    const field = content?.fields.find(
      (candidate) => key === candidate.key || key.startsWith(`${candidate.key}.`),
    );
    return field?.label;
  };
}

/** A line to remind what the section holds: the labels of its first places. */
export function sectionSummary(fields: ContentField[]): string {
  return fields
    .slice(0, 3)
    .map((field) => field.label)
    .join(', ');
}

export function blankItem(field: ContentField): ItemValue {
  return Object.fromEntries(field.item.map((part) => [part.name, part.kind === 'strings' ? [] : '']));
}
