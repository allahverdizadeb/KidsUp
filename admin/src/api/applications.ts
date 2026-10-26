import { del, download, get, patch, post } from './client.ts';
import type { ReadOptions } from './client.ts';
import type {
  ApplicationDetail,
  ApplicationFilter,
  ApplicationPage,
  ApplicationSearch,
  ApplicationStatus,
  Note,
  Pulse,
} from './types.ts';

/**
 * Searches are POST bodies: a name or a phone number never goes into an address. A search the page runs by itself
 * (`background`) does not keep an idle session alive; the API honours that for this POST as for a GET.
 */
export const searchApplications = (search: ApplicationSearch, options?: ReadOptions) =>
  post<ApplicationPage>('/applications/search', search, options);

export const getApplication = (id: string) => get<ApplicationDetail>(`/applications/${id}`);

export const changeStatus = (id: string, status: ApplicationStatus) =>
  patch<ApplicationDetail>(`/applications/${id}`, { status });

export const addNote = (id: string, body: string) => post<Note>(`/applications/${id}/notes`, { body });

export const deleteNote = (id: string, noteId: string) => del(`/applications/${id}/notes/${noteId}`);

/** A family's data erased at its request. The API refuses it without the confirmation. */
export const eraseApplication = (id: string) => del(`/applications/${id}?confirm=true`);

/** Has anything arrived? Marked as a poll, so it does not keep an idle session alive. */
export const getPulse = () => get<Pulse>('/applications/pulse', { background: true });

export const exportApplications = (filter: ApplicationFilter) =>
  download('POST', '/applications/export', { body: filter });
