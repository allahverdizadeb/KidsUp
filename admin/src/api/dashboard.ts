import { get } from './client.ts';
import type { ReadOptions } from './client.ts';
import type { Dashboard } from './types.ts';

export const getDashboard = (days = 30, options?: ReadOptions) =>
  get<Dashboard>(`/dashboard?days=${days}`, options);
