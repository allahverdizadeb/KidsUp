import type { ApplicationStatus } from '../api/types.ts';

/**
 * The four statuses of an application as the design names and colours them. The design says "confirmed" and
 * "rejected" where the API says `approved` and `declined`; the words staff read are the design's.
 */
export interface StatusLook {
  label: string;
  fg: string;
  bg: string;
  dot: string;
}

export const STATUS_ORDER: ApplicationStatus[] = ['new', 'contacted', 'approved', 'declined'];

export const STATUS: Record<ApplicationStatus, StatusLook> = {
  new: { label: 'Yeni', fg: '#C2006A', bg: '#FFEFF7', dot: '#FF0083' },
  contacted: { label: 'Əlaqə saxlanılıb', fg: '#8F5400', bg: '#FFF4E2', dot: '#F29900' },
  approved: { label: 'Təsdiqlənib', fg: '#0F6B43', bg: '#E8F6EE', dot: '#1F9D66' },
  declined: { label: 'İmtina edilib', fg: '#5C5C5C', bg: '#F1F1F1', dot: '#A3A3A3' },
};

/** Avatar colours, taken in turn. */
export const AVATARS: [string, string][] = [
  ['#FFF0F7', '#C2006A'],
  ['#E8F6EE', '#0F6B43'],
  ['#FFF4E2', '#8F5400'],
  ['#F1F1F3', '#4A4A4A'],
];

/** The same family always gets the same colour: from its id. */
export function avatarOf(id: string): [string, string] {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return AVATARS[sum % AVATARS.length] as [string, string];
}
