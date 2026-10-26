import type { RoleName } from '../api/types.ts';
import { ICON } from './icons.ts';

/**
 * The roles staff can hold. The design had Admin, Menecer and Redaktor; the API has `admin`, `coordinator` and
 * `viewer` and no editor (the page content is for admins), so the third card is the viewer. What each role says
 * it may do is what `back/app/panel/permissions.py` lets it do.
 */
export interface RoleLook {
  label: string;
  description: string;
  bg: string;
  fg: string;
  icon: string;
}

export const ROLE_ORDER: RoleName[] = ['admin', 'coordinator', 'viewer'];

export const ROLE: Record<RoleName, RoleLook> = {
  admin: {
    label: 'Admin',
    description: 'Tam giriş: müraciətlər, kurslar, sayt məzmunu, ixrac və silmə. Təsdiqi geri götürə bilər.',
    bg: '#1A1A1A',
    fg: '#FFFFFF',
    icon: ICON.team,
  },
  coordinator: {
    label: 'Menecer',
    description: 'Müraciətlərə baxır, statusu dəyişir və qeyd yazır. Kurslara və sayta toxunmur.',
    bg: '#FFF0F7',
    fg: '#C2006A',
    icon: ICON.user,
  },
  viewer: {
    label: 'Müşahidəçi',
    description: 'Yalnız baxış: idarə paneli, müraciətlər və kurslar. Heç nəyi dəyişə bilməz.',
    bg: '#FFF4E2',
    fg: '#8F5400',
    icon: ICON.eye,
  },
};
