import { useSyncExternalStore } from 'react';
import type { ContentValue } from '../api/types.ts';
import type { Edits } from '../lib/cms.ts';

/**
 * The page editor's unsaved changes live outside the page, so moving to another page of the panel and back does not
 * lose what was typed. They are dropped when the person signs out (or the session ends): nothing is kept in storage.
 */
let edits: Edits = {};
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function setEdit(key: string, value: ContentValue): void {
  edits = { ...edits, [key]: value };
  emit();
}

export function dropEdits(keys: string[]): void {
  if (keys.length === 0) return;
  const next = { ...edits };
  for (const key of keys) delete next[key];
  edits = next;
  emit();
}

export function clearEdits(): void {
  if (Object.keys(edits).length === 0) return;
  edits = {};
  emit();
}

export function useEdits(): Edits {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => edits,
  );
}
