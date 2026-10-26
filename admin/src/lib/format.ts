/** Dates, money, phone numbers and names as the panel shows them. Every moment is shown on the clock in Baku. */

const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
const MONTHS_LONG = [
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
const WEEKDAYS = ['bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə'];
const ENGLISH_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

const BAKU = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Baku',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
});

export interface Moment {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

export function bakuMoment(input: string | Date): Moment {
  const parts: Record<string, string> = {};
  for (const part of BAKU.formatToParts(typeof input === 'string' ? new Date(input) : input)) {
    parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: ENGLISH_WEEKDAYS.indexOf(parts.weekday ?? ''),
  };
}

/** The number of the day in Baku (days since 1970), so two moments can be compared by calendar day. */
function dayNumber(moment: Moment): number {
  return Math.floor(Date.UTC(moment.year, moment.month - 1, moment.day) / DAY_MS);
}

const two = (n: number) => String(n).padStart(2, '0');

/** "18 okt 2026" */
export function formatDate(iso: string): string {
  const m = bakuMoment(iso);
  return `${m.day} ${MONTHS_SHORT[m.month - 1]} ${m.year}`;
}

/** "15:30" */
export function formatTime(iso: string): string {
  const m = bakuMoment(iso);
  return `${two(m.hour)}:${two(m.minute)}`;
}

/** "18 okt 2026, 15:30" */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** A day written as 2026-12-05, in full: "5 dekabr 2026". */
export function formatDay(day: string | null | undefined): string {
  if (!day) return '—';
  const [year, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS_LONG[(month ?? 1) - 1]} ${year}`;
}

/** "18 oktyabr 2026, şənbə" */
export function formatToday(now: string | Date): string {
  const m = bakuMoment(now);
  return `${m.day} ${MONTHS_LONG[m.month - 1]} ${m.year}, ${WEEKDAYS[m.weekday]}`;
}

/** "18 okt 2026" for a day written as 2026-10-18 (the days of the chart). */
export function formatShortDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS_SHORT[(month ?? 1) - 1]} ${year}`;
}

/** "Bu gün, 15:30", "Dünən, 15:30", "3 gün əvvəl". */
export function relativeDay(iso: string, now: string | Date): string {
  const days = dayNumber(bakuMoment(now)) - dayNumber(bakuMoment(iso));
  if (days <= 0) return `Bu gün, ${formatTime(iso)}`;
  if (days === 1) return `Dünən, ${formatTime(iso)}`;
  return `${days} gün əvvəl`;
}

/** How long a family has waited for an answer. */
export function waitingFor(iso: string, now: string | Date): { text: string; days: number } {
  const days = Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / DAY_MS);
  return { days, text: days <= 0 ? 'Bu gün gəlib' : `${days} gündür gözləyir` };
}

/** When a member of staff last signed in. */
export function lastSeen(iso: string | null, now: string | Date): string {
  if (!iso) return 'Hələ daxil olmayıb';
  const hours = Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / HOUR_MS);
  if (hours < 1) return 'İndi aktivdir';
  if (hours < 24) return `${hours} saat əvvəl`;
  return `${Math.floor(hours / 24)} gün əvvəl`;
}

/** The days between two days written as 2026-12-05, plus one, in weeks: the length of a course. */
export function weeksText(start: string, end: string | null): string {
  if (!end) return '—';
  const weeks = Math.round((Date.parse(end) - Date.parse(start)) / DAY_MS / 7) + 1;
  return `${weeks} həftə`;
}

/** "5 dekabr – 10 yanvar 2027": the name a course gets from its dates. */
export function rangeName(start: string, end: string | null): string {
  if (!start) return 'Tarix seçilməyib';
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const first = `${startDay} ${MONTHS_LONG[(startMonth ?? 1) - 1]}`;
  if (!end) return `${first} ${startYear}`;
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const last = `${endDay} ${MONTHS_LONG[(endMonth ?? 1) - 1]}`;
  return startYear === endYear
    ? `${first} – ${last} ${endYear}`
    : `${first} ${startYear} – ${last} ${endYear}`;
}

export function addDays(day: string, days: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + days)).toISOString().slice(0, 10);
}

/**
 * AZN, from the API's qəpik, written as the landing page writes it (front/src/lib/figures.ts): 65000 → "650",
 * 130000 → "1 300", 65050 → "650,50".
 */
export function formatMoney(minor: number): string {
  const manats = String(Math.floor(minor / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const qepik = minor % 100;
  return qepik ? `${manats},${String(qepik).padStart(2, '0')}` : manats;
}

/** The amount for a box to be typed in, not to be read: 65000 → "650", 130000 → "1300", 65050 → "650.50". */
export function plainAmount(minor: number): string {
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}

/** Qəpik, from what was typed in AZN ("650", "650,5"); null when it is not an amount. */
export function toMinor(typed: string): number | null {
  const clean = typed.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

/** A telephone link for the number as the family typed it (+994 50 …, or the local 050 …). */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `tel:+${digits.startsWith('0') ? `994${digits.slice(1)}` : digits}`;
}

/** A short label for an application, to say aloud: the first six characters of its id. */
export function shortId(id: string): string {
  return `#${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
}

export function childAges(ages: number[]): string {
  return `${ages.join(', ')} yaş`;
}
