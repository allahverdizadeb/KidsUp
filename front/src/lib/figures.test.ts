import { describe, expect, it } from 'vitest';
import {
  ageOn,
  courseFigures,
  DEFAULT_COURSE,
  fillPlaceholders,
  formatDate,
  formatMoney,
  formatPercent,
  PLACEHOLDER_NAMES,
  splitMoney,
} from './figures';

describe('formatMoney', () => {
  it.each([
    [65_000, '650 AZN'],
    [50_000, '500 AZN'],
    [115_000, '1 150 AZN'],
    [130_000, '1 300 AZN'],
    [65_050, '650,50 AZN'],
    [65_005, '650,05 AZN'],
    [0, '0 AZN'],
    [123_456_789, '1 234 567,89 AZN'],
  ])('writes %i qəpik as "%s"', (minor, written) => {
    expect(formatMoney(minor)).toBe(written);
  });

  it('splits the amount from the currency for the large price on the page', () => {
    expect(splitMoney(65_000)).toEqual({ amount: '650', currency: 'AZN' });
    expect(splitMoney(130_000)).toEqual({ amount: '1 300', currency: 'AZN' });
  });
});

describe('formatPercent', () => {
  it.each([
    [150 / 1300, '11,5%'],
    [0.1, '10%'],
    [0, '0%'],
    [0.2, '20%'],
  ])('writes %d as "%s"', (fraction, written) => {
    expect(formatPercent(fraction)).toBe(written);
  });
});

describe('formatDate', () => {
  it.each([
    ['2026-12-05', '5 dekabr 2026'],
    ['2027-01-01', '1 yanvar 2027'],
    ['2027-03-06', '6 mart 2027'],
    ['2027-09-30', '30 sentyabr 2027'],
  ])('writes %s as "%s"', (iso, written) => {
    expect(formatDate(iso)).toBe(written);
  });

  it.each(['', 'next Saturday', '2026-13-01', '2026-12-5', '05.12.2026'])(
    'leaves "%s" as it is rather than guessing',
    (text) => {
      expect(formatDate(text)).toBe(text);
    },
  );
});

describe('courseFigures', () => {
  it('works out what the page says about the default programme', () => {
    expect(courseFigures(DEFAULT_COURSE)).toEqual({
      price: '650 AZN',
      price_second: '500 AZN',
      price_double: '1 300 AZN',
      price_family: '1 150 AZN',
      price_saving: '150 AZN',
      saving_percent: '11,5%',
      capacity: '20',
      age_min: '8',
      age_max: '13',
      start_date: '5 dekabr 2026',
      schedule: 'şənbə, 09:30–13:00',
      location: 'Bakı, dəqiq ünvan qeydiyyatdan əvvəl bildiriləcək',
    });
  });

  it('follows a changed price', () => {
    const figures = courseFigures({ ...DEFAULT_COURSE, priceMinor: 70_000, secondChildPriceMinor: 55_000 });

    expect(figures.price_double).toBe('1 400 AZN');
    expect(figures.price_family).toBe('1 250 AZN');
    expect(figures.price_saving).toBe('150 AZN');
    expect(figures.saving_percent).toBe('10,7%');
  });

  it('does not divide by zero for a free course', () => {
    const figures = courseFigures({ ...DEFAULT_COURSE, priceMinor: 0, secondChildPriceMinor: 0 });

    expect(figures.saving_percent).toBe('0%');
    expect(figures.price).toBe('0 AZN');
  });

  it('knows exactly the names that the panel allows in a text', () => {
    expect(Object.keys(courseFigures(DEFAULT_COURSE)).sort()).toEqual([...PLACEHOLDER_NAMES].sort());
  });
});

describe('fillPlaceholders', () => {
  const figures = courseFigures(DEFAULT_COURSE);

  it('replaces every known name, also when it appears twice', () => {
    expect(fillPlaceholders('{price} və {price}, ən çoxu {capacity} uşaq', figures)).toBe(
      '650 AZN və 650 AZN, ən çoxu 20 uşaq',
    );
  });

  it('leaves a name it does not know, and braces that are not a name, untouched', () => {
    expect(fillPlaceholders('{nothing} {Price} { price } {}', figures)).toBe(
      '{nothing} {Price} { price } {}',
    );
  });

  it('leaves a text without names as it is', () => {
    expect(fillPlaceholders('Kiçik ideyalar.', figures)).toBe('Kiçik ideyalar.');
  });
});

describe('ageOn', () => {
  it.each([
    ['2016-05-20', 10, '2026-12-05'],
    ['2018-12-05', 8, '2026-12-05'], // the birthday itself counts
    ['2018-12-06', 7, '2026-12-05'], // one day short of it
    ['2018-11-30', 8, '2026-12-05'],
    ['2010-01-01', 16, '2026-12-05'],
  ])('a child born %s is %i years old on %s', (born, age, day) => {
    expect(ageOn(born, day)).toBe(age);
  });

  it.each([
    ['', '2026-12-05'],
    ['2016-05-20', ''],
    ['not a date', '2026-12-05'],
  ])('is null when "%s" or "%s" is not a date', (born, day) => {
    expect(ageOn(born, day)).toBeNull();
  });
});
