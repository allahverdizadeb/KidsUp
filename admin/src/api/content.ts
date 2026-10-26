import { get, post, put, request } from './client.ts';
import type { Content, ContentValue, MediaAsset, Publication } from './types.ts';

export const getContent = () => get<Content>('/content');

/** Save the draft. A null puts a place back to its default. Nothing reaches the landing page yet. */
export const saveDraft = (values: Record<string, ContentValue>) => put<Content>('/content', { values });

/** Publish the whole draft, or only the places in `keys` (the rest of the draft waits). */
export const publish = (keys?: string[]) =>
  post<Publication>('/content/publications', keys ? { keys } : undefined);

export const uploadPicture = (file: File) =>
  request<MediaAsset>('POST', '/media', { raw: { data: file, type: file.type } });
