import { get } from './client.ts';
import type { StaffList } from './types.ts';

/** Who has access to the panel (admins only). Read-only: accounts are made by the operator's command. */
export const listStaff = () => get<StaffList>('/users');
