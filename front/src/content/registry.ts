import registryFile from './registry.json';

// The places on the page that staff may change, with what each shows by default. The list is owned by back/
// (back/app/panel/content_registry.json); this folder keeps a copy, and registry.test.ts fails if the two differ.

export type FieldKind = 'text' | 'paragraph' | 'link' | 'phone' | 'digits' | 'image' | 'strings' | 'list';
export type ItemPartKind = 'text' | 'paragraph' | 'strings';
export type ItemPart = { name: string; kind: ItemPartKind };
export type RegistryField = {
  key: string;
  kind: FieldKind;
  defaultValue: unknown;
  parts: ItemPart[];
  minItems: number;
  maxItems: number;
  /** For a link: the only hosts an https address may name (none given: any; empty: none). */
  hosts: readonly string[] | undefined;
};

const FIELD_KINDS: readonly string[] = [
  'text',
  'paragraph',
  'link',
  'phone',
  'digits',
  'image',
  'strings',
  'list',
];
const PART_KINDS: readonly string[] = ['text', 'paragraph', 'strings'];

// What the page accepts from the published file, whatever it holds: the same shapes the panel allows (and a
// little less), so a tampered file can put at most a different text on the page, never a script or a foreign address.
const SAFE_LINK = /^(https:\/\/[^\s\\@]+|\/[^\s\\/][^\s\\]*|\/|#[\w-]{1,60}|tel:\+\d{7,15})$/;
const SAFE_PICTURE =
  /^\/(media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp|assets\/[\w.-]+)$/;
// The page builds `tel:+<digits>` and `https://wa.me/<digits>` from these two, so they must have their shape.
const SAFE_PHONE = /^\+\d[\d ()-]{7,22}$/;
const SAFE_WHATSAPP = /^[1-9]\d{9,14}$/;
const LONGEST_TEXT = 5000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFieldKind(value: unknown): value is FieldKind {
  return typeof value === 'string' && FIELD_KINDS.includes(value);
}

function isItemPartKind(value: unknown): value is ItemPartKind {
  return typeof value === 'string' && PART_KINDS.includes(value);
}

function readParts(value: unknown): ItemPart[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((part: unknown) =>
    isRecord(part) && typeof part.name === 'string' && isItemPartKind(part.kind)
      ? [{ name: part.name, kind: part.kind }]
      : [],
  );
}

function readHosts(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) ? value.filter((host: unknown) => typeof host === 'string') : undefined;
}

function readFields(file: unknown): RegistryField[] {
  if (!isRecord(file) || !Array.isArray(file.fields)) throw new Error('The content registry is malformed.');
  return file.fields.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.key === 'string' && isFieldKind(entry.kind)
      ? [
          {
            key: entry.key,
            kind: entry.kind,
            defaultValue: entry.default,
            parts: readParts(entry.item),
            minItems: typeof entry.min_items === 'number' ? entry.min_items : 0,
            maxItems: typeof entry.max_items === 'number' ? entry.max_items : Infinity,
            hosts: readHosts(entry.hosts),
          },
        ]
      : [],
  );
}

export const REGISTRY: ReadonlyMap<string, RegistryField> = new Map(
  readFields(registryFile).map((field) => [field.key, field]),
);

/** The place with that key. An unknown key is a mistake in the code, not something to fall back from. */
export function registryField(key: string): RegistryField {
  const field = REGISTRY.get(key);
  if (!field) throw new Error(`No place on the page is called ${key}.`);
  return field;
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= LONGEST_TEXT;
}

function isLines(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText);
}

function hasRightCount(field: RegistryField, value: unknown[]): boolean {
  return value.length >= field.minItems && value.length <= field.maxItems;
}

function isPartValue(part: ItemPart, value: unknown): boolean {
  return part.kind === 'strings' ? isLines(value) : isText(value);
}

/** Whether an address that leaves the site names a host its place allows (a place that names none allows any). */
function isOnAnAllowedHost(address: string, hosts: readonly string[] | undefined): boolean {
  if (!address.startsWith('https://')) return true; // a path on the site, an anchor, a telephone link
  if (hosts === undefined) return true;
  try {
    return hosts.includes(new URL(address).hostname);
  } catch {
    return false;
  }
}

/** The value if it has the shape its place needs, otherwise undefined (and the page shows the default). */
export function acceptValue(field: RegistryField, value: unknown): unknown {
  switch (field.kind) {
    case 'text':
    case 'paragraph':
      return isText(value) ? value : undefined;
    case 'phone':
      return isText(value) && SAFE_PHONE.test(value) ? value : undefined;
    case 'digits':
      return isText(value) && SAFE_WHATSAPP.test(value) ? value : undefined;
    case 'link':
      return isText(value) && SAFE_LINK.test(value) && isOnAnAllowedHost(value, field.hosts)
        ? value
        : undefined;
    case 'image':
      return isText(value) && SAFE_PICTURE.test(value) ? value : undefined;
    case 'strings':
      return isLines(value) && hasRightCount(field, value) ? value : undefined;
    case 'list':
      return Array.isArray(value) &&
        hasRightCount(field, value) &&
        value.every(
          (entry: unknown) =>
            isRecord(entry) && field.parts.every((part) => isPartValue(part, entry[part.name])),
        )
        ? value
        : undefined;
  }
}
