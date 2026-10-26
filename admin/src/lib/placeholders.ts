import type { Course } from '../api/types.ts';
import { formatDay, formatMoney } from './format.ts';

const azn = (minor: number) => `${formatMoney(minor)} AZN`;

/** A share as the landing page writes it: 0.1 → "10%", 0.1154 → "11,5%". */
function percent(fraction: number): string {
  return `${String(Math.round(fraction * 1000) / 10).replace('.', ',')}%`;
}

/**
 * The figures the landing page puts in place of {price}, {age_min}… in a text, from the course it shows. The preview
 * in the panel does the same with the course the form is tied to now, so a text reads as it will read on the page.
 * The wording of the figures is the page's own, character for character.
 */
export function placeholderValues(course: Course | null): Record<string, string> {
  if (!course) return {};
  const double = course.price_minor * 2;
  const family = course.price_minor + course.second_child_price_minor;
  const saving = double - family;
  return {
    price: azn(course.price_minor),
    price_second: azn(course.second_child_price_minor),
    price_double: azn(double),
    price_family: azn(family),
    price_saving: azn(saving),
    saving_percent: percent(double ? saving / double : 0),
    capacity: String(course.capacity),
    age_min: String(course.age_min),
    age_max: String(course.age_max),
    start_date: formatDay(course.start_date),
    schedule: course.schedule,
    location: course.location,
  };
}

/** The text with the known {names} replaced; a name with no figure stays as it is. */
export function fillPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(/\{([a-z_]+)\}/g, (whole, name: string) => values[name] ?? whole);
}
