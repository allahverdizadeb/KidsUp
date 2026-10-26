import type { ApplicationSummary, Course, DailyCount } from '../api/types.ts';

export interface FlowStats {
  days: string[];
  daily: number[];
  /** The tallest bar's value; never below 4, so a quiet month does not look busy. */
  max: number;
  total: number;
  /** The last seven days, and the seven before them. */
  week: number;
  previousWeek: number;
  average: number;
}

export function flowStats(dynamics: DailyCount[]): FlowStats {
  const daily = dynamics.map((entry) => entry.applications);
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const total = sum(daily);
  return {
    days: dynamics.map((entry) => entry.day),
    daily,
    max: Math.max(4, ...daily),
    total,
    week: sum(daily.slice(-7)),
    previousWeek: sum(daily.slice(-14, -7)),
    average: daily.length ? total / daily.length : 0,
  };
}

/** A share of a whole as a number of percent; nothing divided by nothing. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** The course the landing page's form is tied to now (the design allows one). */
export function activeCourse(courses: Course[]): Course | null {
  return courses.find((course) => course.registration_open) ?? null;
}

/** The names of an application's children for a line of text: "Leyla" or "Leyla, Murad". */
export function childNames(application: Pick<ApplicationSummary, 'children'>): string {
  return application.children.map((child) => child.name).join(', ');
}

export function childAgesText(application: Pick<ApplicationSummary, 'children'>): string {
  return `${application.children.map((child) => child.age_at_course_start).join(', ')} yaş`;
}

/** Seats of a course for the grid: taken, waiting (one per undecided application, as many as are free), empty. */
export function seatCells(course: Course): ('taken' | 'waiting' | 'empty')[] {
  const total = Math.min(course.capacity, 100);
  const taken = Math.min(course.seats.approved_children, total);
  const undecided = course.seats.applications.new + course.seats.applications.contacted;
  const waiting = Math.min(
    Math.max(0, course.capacity - course.seats.approved_children),
    undecided,
    total - taken,
  );
  return Array.from({ length: total }, (_, index) =>
    index < taken ? 'taken' : index < taken + waiting ? 'waiting' : 'empty',
  );
}
