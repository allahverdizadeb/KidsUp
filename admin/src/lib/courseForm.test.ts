import { describe, expect, it } from 'vitest';
import { makeCourse } from '../test/fixtures.ts';
import { blankForm, changesFor, formOf, titleFor, toInput, validate, withStart } from './courseForm.ts';
import type { CourseForm } from './courseForm.ts';

const valid: CourseForm = {
  start: '2027-03-06',
  end: '2027-04-10',
  schedule: 'Şənbə, 09:30–13:00',
  location: 'Bakı',
  price: '650',
  second: '500',
  max: '20',
  open: false,
};

describe('a new course', () => {
  it('starts with the programme usual figures and opens on the site only if no other course is open', () => {
    expect(blankForm(false)).toMatchObject({
      price: '650',
      second: '500',
      max: '20',
      open: true,
      start: '',
      end: '',
    });
    expect(blankForm(true).open).toBe(false);
  });

  it('offers an end date six weeks later when only the start was chosen', () => {
    expect(withStart(blankForm(false), '2026-12-05')).toMatchObject({
      start: '2026-12-05',
      end: '2027-01-15',
    });
  });

  it('leaves an end date that was chosen alone', () => {
    expect(withStart({ ...blankForm(false), end: '2027-02-01' }, '2026-12-05').end).toBe('2027-02-01');
    expect(withStart(blankForm(false), '').end).toBe('');
  });
});

describe('the form of a course that exists', () => {
  it('shows the stored figures as typed', () => {
    expect(formOf(makeCourse({ end_date: null, price_minor: 65_050 }))).toMatchObject({
      start: '2026-12-05',
      end: '',
      price: '650.50',
      second: '500',
      max: '20',
      open: true,
    });
  });
});

describe('validate', () => {
  it('accepts a good form', () => {
    expect(validate(valid, 0)).toEqual({});
  });

  it('wants a start date, and an end date only if one was given', () => {
    expect(validate({ ...valid, start: '' }, 0).start).toMatch(/Başlanğıc/);
    expect(validate({ ...valid, start: '1999-01-01' }, 0).start).toBeDefined();
    expect(validate({ ...valid, end: '' }, 0)).toEqual({});
    expect(validate({ ...valid, end: 'later' }, 0).end).toBeDefined();
  });

  it('wants the end after the start', () => {
    expect(validate({ ...valid, end: '2027-03-06' }, 0).end).toMatch(/başlanğıcdan sonra/);
    expect(validate({ ...valid, end: '2027-03-05' }, 0).end).toMatch(/başlanğıcdan sonra/);
  });

  it('wants a schedule and a place of reasonable length', () => {
    expect(validate({ ...valid, schedule: '  ' }, 0).schedule).toBeDefined();
    expect(validate({ ...valid, schedule: 'x'.repeat(121) }, 0).schedule).toBeDefined();
    expect(validate({ ...valid, location: '' }, 0).location).toBeDefined();
    expect(validate({ ...valid, location: 'x'.repeat(201) }, 0).location).toBeDefined();
  });

  it('wants a price above nothing, and a second price that is an amount', () => {
    expect(validate({ ...valid, price: '0' }, 0).price).toBeDefined();
    expect(validate({ ...valid, price: 'abc' }, 0).price).toBeDefined();
    expect(validate({ ...valid, price: '99999999' }, 0).price).toBeDefined();
    expect(validate({ ...valid, price: '100001' }, 0).price).toMatch(/böyük/);
    expect(validate({ ...valid, second: '0' }, 0)).toEqual({});
    expect(validate({ ...valid, second: '-1' }, 0).second).toBeDefined();
    expect(validate({ ...valid, second: '100001' }, 0).second).toMatch(/böyük/);
  });

  it('wants whole places between one and the most the API takes, and not fewer than the approved children', () => {
    expect(validate({ ...valid, max: '0' }, 0).max).toMatch(/Ən azı 1/);
    expect(validate({ ...valid, max: '1.5' }, 0).max).toBeDefined();
    expect(validate({ ...valid, max: '' }, 0).max).toBeDefined();
    expect(validate({ ...valid, max: '501' }, 0).max).toMatch(/500/);
    expect(validate({ ...valid, max: '5' }, 7).max).toMatch(/7 təsdiqlənmiş/);
    expect(validate({ ...valid, max: '7' }, 7)).toEqual({});
  });
});

describe('the name of a course', () => {
  const stored = makeCourse({
    title: '5 dekabr 2026 – 10 yanvar 2027',
    start_date: '2026-12-05',
    end_date: '2027-01-10',
  });

  it('comes from the dates for a new course', () => {
    expect(titleFor(valid, null)).toBe('6 mart – 10 aprel 2027');
  });

  it('stays while the dates stay', () => {
    expect(titleFor(formOf(stored), stored)).toBe(stored.title);
    expect(titleFor(formOf({ ...stored, title: 'Yaz qrupu' }), { ...stored, title: 'Yaz qrupu' })).toBe(
      'Yaz qrupu',
    );
  });

  it('is made again from new dates if it was made from the old ones', () => {
    expect(titleFor({ ...formOf(stored), start: '2026-12-12' }, stored)).toBe(
      '12 dekabr 2026 – 10 yanvar 2027',
    );
  });

  it('is kept when somebody named the course by hand, even if the dates move', () => {
    const named = { ...stored, title: 'Yaz qrupu' };
    expect(titleFor({ ...formOf(named), start: '2026-12-12' }, named)).toBe('Yaz qrupu');
  });
});

describe('what is sent to the API', () => {
  it('builds a course from a form, with the programme ages for a new one', () => {
    expect(toInput({ ...valid, schedule: ' Şənbə ', open: true }, null)).toEqual({
      title: '6 mart – 10 aprel 2027',
      start_date: '2027-03-06',
      end_date: '2027-04-10',
      schedule: 'Şənbə',
      location: 'Bakı',
      age_min: 8,
      age_max: 13,
      price_minor: 65_000,
      second_child_price_minor: 50_000,
      capacity: 20,
      registration_open: true,
    });
  });

  it('keeps the ages of a course that exists, and sends no end date when there is none', () => {
    const course = makeCourse({ age_min: 9, age_max: 12 });
    expect(toInput({ ...valid, end: '' }, course)).toMatchObject({ age_min: 9, age_max: 12, end_date: null });
  });

  it('sends only what changed', () => {
    const course = makeCourse();
    const same = toInput(formOf(course), course);
    expect(changesFor(same, course)).toEqual({});
    expect(changesFor({ ...same, capacity: 25, end_date: null, registration_open: false }, course)).toEqual({
      capacity: 25,
      end_date: null,
      registration_open: false,
    });
  });
});
