import type { ReactNode } from 'react';
import type { PublicContent } from '../api/publicContent';
import { PublicContentContext } from './PublicContentContext';

type PublicContentProviderProps = { content: PublicContent; children: ReactNode };

/** Hands what the admin panel published (texts, pictures, open courses) to the sections of the page. */
export default function PublicContentProvider({ content, children }: PublicContentProviderProps) {
  return <PublicContentContext value={content}>{children}</PublicContentContext>;
}
