import { describe, expect, it } from 'vitest';
import {
  addDays,
  bakuMoment,
  formatDate,
  formatDateTime,
  formatDay,
  formatMoney,
  formatShortDay,
  formatTime,
  formatToday,
  initials,
  lastSeen,
  plainAmount,
  rangeName,
  relativeDay,
  shortId,
  telHref,
  toMinor,
  waitingFor,
  weeksText,
} from './format.ts';

// 2026-10-18 11:30 UTC is 15:30 in Baku (UTC+4, all year).
const NOW = '2026-10-18T11:30:00Z';

describe('dates are shown on the clock in Baku', () => {
  it('moves a moment to Baku, across midnight too', () => {
    expect(bakuMoment('2026-10-18T21:30:00Z')).toMatchObject({
      year: 2026,
      month: 10,
      day: 19,
      hour: 1,
      minute: 30,
    });
    expect(bakuMoment(new Date(NOW))).toMatchObject({ day: 18, hour: 15, minute: 30, weekday: 0 });
  });

  it('writes the date, the time and both', () => {
    expect(formatDate(NOW)).toBe('18 okt 2026');
    expect(formatTime(NOW)).toBe('15:30');
    expect(formatDateTime(NOW)).toBe('18 okt 2026, 15:30');
    expect(formatTime('2026-10-18T05:05:00Z')).toBe('09:05');
  });

  it('writes a day in full and today with its weekday', () => {
    expect(formatDay('2026-12-05')).toBe('5 dekabr 2026');
    expect(formatDay(null)).toBe('—');
    expect(formatToday(NOW)).toBe('18 oktyabr 2026, bazar');
    expect(formatToday('2026-12-05T08:00:00Z')).toBe('5 dekabr 2026, şənbə');
    expect(formatShortDay('2026-10-04')).toBe('4 okt 2026');
  });

  it('says how long ago, by calendar day', () => {
    expect(relativeDay('2026-10-18T05:00:00Z', NOW)).toBe('Bu gün, 09:00');
    expect(relativeDay('2026-10-17T20:30:00Z', NOW)).toBe('Bu gün, 00:30'); // already the 18th in Baku
    expect(relativeDay('2026-10-17T10:00:00Z', NOW)).toBe('Dünən, 14:00');
    expect(relativeDay('2026-10-14T10:00:00Z', NOW)).toBe('4 gün əvvəl');
  });

  it('says how long a family has waited, and when staff last signed in', () => {
    expect(waitingFor('2026-10-18T05:00:00Z', NOW)).toEqual({ days: 0, text: 'Bu gün gəlib' });
    expect(waitingFor('2026-10-15T05:00:00Z', NOW)).toEqual({ days: 3, text: '3 gündür gözləyir' });
    expect(lastSeen(null, NOW)).toBe('Hələ daxil olmayıb');
    expect(lastSeen('2026-10-18T11:10:00Z', NOW)).toBe('İndi aktivdir');
    expect(lastSeen('2026-10-18T06:30:00Z', NOW)).toBe('5 saat əvvəl');
    expect(lastSeen('2026-10-15T11:30:00Z', NOW)).toBe('3 gün əvvəl');
  });
});

describe('courses', () => {
  it('counts weeks from the first day to the last, both included', () => {
    expect(weeksText('2026-12-05', '2027-01-10')).toBe('6 həftə');
    expect(weeksText('2026-12-05', null)).toBe('—');
  });

  it('names a course from its dates', () => {
    expect(rangeName('2026-12-05', '2027-01-10')).toBe('5 dekabr 2026 – 10 yanvar 2027');
    expect(rangeName('2027-01-16', '2027-02-21')).toBe('16 yanvar – 21 fevral 2027');
    expect(rangeName('2026-12-05', null)).toBe('5 dekabr 2026');
    expect(rangeName('', null)).toBe('Tarix seçilməyib');
  });

  it('adds days across a month and a year', () => {
    expect(addDays('2026-12-05', 36)).toBe('2027-01-10');
    expect(addDays('2026-02-27', 3)).toBe('2026-03-02');
  });
});

describe('money', () => {
  it('shows qəpik as AZN, as the landing page writes it', () => {
    expect(formatMoney(65_000)).toBe('650');
    expect(formatMoney(65_050)).toBe('650,50');
    expect(formatMoney(0)).toBe('0');
    expect(formatMoney(130_000)).toBe('1 300');
    expect(formatMoney(115_005)).toBe('1 150,05');
    expect(formatMoney(123_456_700)).toBe('1 234 567');
  });

  it('writes an amount for a box with a dot and no grouping, so that it reads back the same', () => {
    expect(plainAmount(65_000)).toBe('650');
    expect(plainAmount(130_000)).toBe('1300');
    expect(plainAmount(65_050)).toBe('650.50');
    for (const minor of [65_000, 130_000, 65_050, 115_005, 0])
      expect(toMinor(plainAmount(minor))).toBe(minor);
  });

  it('reads what was typed', () => {
    expect(toMinor('650')).toBe(65_000);
    expect(toMinor(' 650,5 ')).toBe(65_050);
    expect(toMinor('650.25')).toBe(65_025);
    for (const bad of ['', 'abc', '-5', '1.234', '12345678', '1e3', '6 50']) expect(toMinor(bad)).toBeNull();
  });
});

describe('people', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Aysel Məmmədova')).toBe('AM');
    expect(initials('  leyla  ')).toBe('L');
    expect(initials('A B C')).toBe('AB');
    expect(initials('')).toBe('');
  });

  it('makes a telephone link from the number as it was typed', () => {
    expect(telHref('+994 50 123 45 67')).toBe('tel:+994501234567');
    expect(telHref('050 123 45 67')).toBe('tel:+994501234567');
    expect(telHref('+7 (900) 111-22-33')).toBe('tel:+79001112233');
  });

  it('shortens an id to something to say aloud', () => {
    expect(shortId('3f2a9c10-1111-4222-8333-444455556666')).toBe('#3F2A9C');
  });
});
