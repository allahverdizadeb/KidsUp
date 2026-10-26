import type { Course, CourseChanges, CourseInput } from '../api/types.ts';
import { addDays, plainAmount, rangeName, toMinor } from './format.ts';

/** What the course window holds while it is open: everything as typed, before it is checked. */
export interface CourseForm {
  start: string;
  end: string;
  schedule: string;
  location: string;
  /** AZN, as typed. */
  price: string;
  second: string;
  max: string;
  open: boolean;
}

export type CourseField = 'start' | 'end' | 'schedule' | 'location' | 'price' | 'second' | 'max';
export type CourseErrors = Partial<Record<CourseField, string>>;

export const STANDARD_PRICE = 650;
export const PILOT_PRICE = 500;
export const DEFAULT_SEATS = 20;
export const DEFAULT_AGES = { min: 8, max: 13 };
const MIN_DAY = '2020-01-01';
const MAX_DAY = '2100-12-31';
const MAX_PRICE_MINOR = 10_000_000;
const MAX_SEATS = 500;
/** A course lasts six weeks: the end date offered when only the start was chosen. */
const SIX_WEEKS_LESS_ONE_DAY = 6 * 7 - 1;

/** A new course: the programme's usual figures, open on the site only if no other course is. */
export function blankForm(anotherIsOpen: boolean): CourseForm {
  return {
    start: '',
    end: '',
    schedule: 'Şənbə, 09:30–13:00',
    location: 'Bakı',
    price: String(STANDARD_PRICE),
    second: String(PILOT_PRICE),
    max: String(DEFAULT_SEATS),
    open: !anotherIsOpen,
  };
}

export function formOf(course: Course): CourseForm {
  return {
    start: course.start_date,
    end: course.end_date ?? '',
    schedule: course.schedule,
    location: course.location,
    price: plainAmount(course.price_minor),
    second: plainAmount(course.second_child_price_minor),
    max: String(course.capacity),
    open: course.registration_open,
  };
}

/** Choosing the start date offers an end date six weeks later, if none was chosen yet (the design does the same). */
export function withStart(form: CourseForm, start: string): CourseForm {
  return !form.end && start
    ? { ...form, start, end: addDays(start, SIX_WEEKS_LESS_ONE_DAY) }
    : { ...form, start };
}

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= MIN_DAY && value <= MAX_DAY;

/** The faults of a form, field by field, in the words staff read. `approved` is how many children are approved already. */
export function validate(form: CourseForm, approved: number): CourseErrors {
  const errors: CourseErrors = {};
  if (!isDay(form.start)) errors.start = 'Başlanğıc tarixini seçin.';
  if (form.end) {
    if (!isDay(form.end)) errors.end = 'Bitmə tarixini düzgün seçin.';
    else if (isDay(form.start) && form.end <= form.start)
      errors.end = 'Bitmə tarixi başlanğıcdan sonra olmalıdır.';
  }
  if (!form.schedule.trim()) errors.schedule = 'Cədvəli daxil edin.';
  else if (form.schedule.trim().length > 120) errors.schedule = 'Cədvəl 120 simvoldan uzun ola bilməz.';
  if (!form.location.trim()) errors.location = 'Məkanı daxil edin.';
  else if (form.location.trim().length > 200) errors.location = 'Məkan 200 simvoldan uzun ola bilməz.';

  const price = toMinor(form.price);
  if (price === null || price <= 0) errors.price = 'Qiymət 0-dan böyük olmalıdır.';
  else if (price > MAX_PRICE_MINOR) errors.price = 'Qiymət çox böyükdür.';
  const second = toMinor(form.second);
  if (second === null) errors.second = 'Qiyməti düzgün daxil edin.';
  else if (second > MAX_PRICE_MINOR) errors.second = 'Qiymət çox böyükdür.';

  const seats = Number(form.max);
  if (!/^\d+$/.test(form.max.trim()) || seats < 1) errors.max = 'Ən azı 1 iştirakçı olmalıdır.';
  else if (seats > MAX_SEATS) errors.max = `Ən çox ${MAX_SEATS} iştirakçı ola bilər.`;
  else if (seats < approved) errors.max = `Bu kursda artıq ${approved} təsdiqlənmiş iştirakçı var.`;
  return errors;
}

/**
 * The name a course gets: from its dates. A course that was named by hand keeps its name as long as its dates stay;
 * when they change, only a name that was made from the old dates is made again.
 */
export function titleFor(form: CourseForm, course: Course | null): string {
  const fresh = rangeName(form.start, form.end || null);
  if (!course) return fresh;
  const datesKept = course.start_date === form.start && (course.end_date ?? '') === form.end;
  if (datesKept) return course.title;
  return course.title === rangeName(course.start_date, course.end_date) ? fresh : course.title;
}

/** The API's course from a form that passed `validate`. */
export function toInput(form: CourseForm, course: Course | null): CourseInput {
  return {
    title: titleFor(form, course),
    start_date: form.start,
    end_date: form.end || null,
    schedule: form.schedule.trim(),
    location: form.location.trim(),
    age_min: course?.age_min ?? DEFAULT_AGES.min,
    age_max: course?.age_max ?? DEFAULT_AGES.max,
    price_minor: toMinor(form.price) ?? 0,
    second_child_price_minor: toMinor(form.second) ?? 0,
    capacity: Number(form.max),
    registration_open: form.open,
  };
}

/** Only what differs from the stored course, so the audit log names exactly what changed. */
export function changesFor(input: CourseInput, course: Course): CourseChanges {
  const changes: CourseChanges = {};
  const same = <K extends keyof CourseInput>(key: K, stored: CourseInput[K]) => {
    if (input[key] !== stored) (changes as Record<string, unknown>)[key] = input[key];
  };
  same('title', course.title);
  same('start_date', course.start_date);
  same('end_date', course.end_date);
  same('schedule', course.schedule);
  same('location', course.location);
  same('price_minor', course.price_minor);
  same('second_child_price_minor', course.second_child_price_minor);
  same('capacity', course.capacity);
  same('registration_open', course.registration_open);
  return changes;
}

/** Which field of the form an API field belongs to, for a refusal that names one. */
export const FIELD_OF_API: Record<string, CourseField> = {
  start_date: 'start',
  end_date: 'end',
  schedule: 'schedule',
  location: 'location',
  price_minor: 'price',
  second_child_price_minor: 'second',
  capacity: 'max',
};
