import { describe, expect, it } from 'vitest';
import { makeCourse } from '../test/fixtures.ts';
import { fillPlaceholders, placeholderValues } from './placeholders.ts';

describe('placeholders in texts', () => {
  it('are replaced with the figures of the course, written as the landing page writes them', () => {
    const values = placeholderValues(makeCourse());

    expect(values).toMatchObject({
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
      schedule: 'Şənbə, 09:30–13:00',
      location: 'Bakı',
    });
    expect(fillPlaceholders('{age_min}–{age_max} yaş, {price}', values)).toBe('8–13 yaş, 650 AZN');
  });

  it('write a round share without a decimal, and qəpik with two digits', () => {
    const values = placeholderValues(makeCourse({ price_minor: 10_050, second_child_price_minor: 8_000 }));

    expect(values.price).toBe('100,50 AZN');
    expect(values.saving_percent).toBe('10,2%');
    expect(
      placeholderValues(makeCourse({ price_minor: 10_000, second_child_price_minor: 8_000 })),
    ).toMatchObject({
      price_double: '200 AZN',
      saving_percent: '10%',
    });
  });

  it('group the thousands of a big price with a space', () => {
    const values = placeholderValues(makeCourse({ price_minor: 123_456_700 }));

    expect(values.price).toBe('1 234 567 AZN');
  });

  it('do not divide by nothing when the course costs nothing', () => {
    const values = placeholderValues(makeCourse({ price_minor: 0, second_child_price_minor: 0 }));

    expect(values.saving_percent).toBe('0%');
    expect(values.price).toBe('0 AZN');
  });

  it('stay as they are where there is no course, or no figure', () => {
    expect(placeholderValues(null)).toEqual({});
    expect(fillPlaceholders('{price} {typo}', { price: '650 AZN' })).toBe('650 AZN {typo}');
    expect(fillPlaceholders('{price}', {})).toBe('{price}');
  });
});
