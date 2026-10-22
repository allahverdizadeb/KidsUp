import type { PublicCourse } from '../api/publicContent';

// Pure helpers for the figures of a course: how a price, a date and a percentage are written on the page, and the
// names ({price}, {capacity} ...) that a text may contain (back/app/panel/content_values.py lists the same names).

export type CourseFacts = {
  startDate: string; // 2026-12-05
  schedule: string;
  location: string;
  ageMin: number;
  ageMax: number;
  priceMinor: number; // whole qəpik: 1 AZN = 100 qəpik
  secondChildPriceMinor: number;
  capacity: number;
};

/** The programme the page advertised before courses could be managed; what is shown when no course list loads. */
export const DEFAULT_COURSE: CourseFacts = {
  startDate: '2026-12-05',
  schedule: 'şənbə, 09:30–13:00',
  location: 'Bakı, dəqiq ünvan qeydiyyatdan əvvəl bildiriləcək',
  ageMin: 8,
  ageMax: 13,
  priceMinor: 65_000,
  secondChildPriceMinor: 50_000,
  capacity: 20,
};

/** The facts of a course from the published list, in the shape the figures are worked out from. */
export function courseFacts(course: PublicCourse): CourseFacts {
  return {
    startDate: course.startDate,
    schedule: course.schedule,
    location: course.location,
    ageMin: course.ageMin,
    ageMax: course.ageMax,
    priceMinor: course.priceMinor,
    secondChildPriceMinor: course.secondChildPriceMinor,
    capacity: course.capacity,
  };
}

const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avqust',
  'sentyabr',
  'oktyabr',
  'noyabr',
  'dekabr',
];

export const PLACEHOLDER_NAMES = [
  'price',
  'price_second',
  'price_double',
  'price_family',
  'price_saving',
  'saving_percent',
  'capacity',
  'age_min',
  'age_max',
  'start_date',
  'schedule',
  'location',
] as const;
export type PlaceholderName = (typeof PLACEHOLDER_NAMES)[number];
export type Figures = Record<PlaceholderName, string>;

/** 65000 → { amount: "650", currency: "AZN" }, 130000 → "1 300", 65050 → "650,50". */
export function splitMoney(minor: number): { amount: string; currency: string } {
  const manats = String(Math.floor(minor / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const qepik = minor % 100;
  return { amount: `${manats}${qepik ? `,${String(qepik).padStart(2, '0')}` : ''}`, currency: 'AZN' };
}

/** 65000 → "650 AZN", 130000 → "1 300 AZN", 65050 → "650,50 AZN". */
export function formatMoney(minor: number): string {
  const { amount, currency } = splitMoney(minor);
  return `${amount} ${currency}`;
}

/** 0.1154 → "11,5%". */
export function formatPercent(fraction: number): string {
  return `${String(Math.round(fraction * 1000) / 10).replace('.', ',')}%`;
}

/** "2026-12-05" → "5 dekabr 2026". Anything else comes back as it was. */
export function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${Number(match[3])} ${month} ${match[1]}` : iso;
}

/** The names a text may contain, with what each stands for in this course. */
export function courseFigures(course: CourseFacts): Figures {
  const double = course.priceMinor * 2;
  const family = course.priceMinor + course.secondChildPriceMinor;
  const saving = double - family;
  return {
    price: formatMoney(course.priceMinor),
    price_second: formatMoney(course.secondChildPriceMinor),
    price_double: formatMoney(double),
    price_family: formatMoney(family),
    price_saving: formatMoney(saving),
    saving_percent: formatPercent(double ? saving / double : 0),
    capacity: String(course.capacity),
    age_min: String(course.ageMin),
    age_max: String(course.ageMax),
    start_date: formatDate(course.startDate),
    schedule: course.schedule,
    location: course.location,
  };
}

function isPlaceholderName(name: string): name is PlaceholderName {
  return PLACEHOLDER_NAMES.some((known) => known === name);
}

/** Replaces {price} and the other names; a name that is not known stays as it is. */
export function fillPlaceholders(text: string, figures: Figures): string {
  return text.replace(/\{([a-z_]+)\}/g, (whole, name: string) =>
    isPlaceholderName(name) ? figures[name] : whole,
  );
}

/** A child's age in whole years on a day; both dates are written 2026-12-05. Null if either is not a date. */
export function ageOn(birthDate: string, day: string): number | null {
  const born = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const on = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!born || !on) return null;
  const hadBirthday =
    Number(on[2]) > Number(born[2]) || (on[2] === born[2] && Number(on[3]) >= Number(born[3]));
  return Number(on[1]) - Number(born[1]) - (hadBirthday ? 0 : 1);
}
