import { useContext } from 'react';
import type { PublicCourse } from '../api/publicContent';
import { PublicContentContext } from '../content/PublicContentContext';
import { acceptValue, registryField } from '../content/registry';
import {
  courseFacts,
  courseFigures,
  DEFAULT_COURSE,
  fillPlaceholders,
  type CourseFacts,
  type Figures,
} from '../lib/figures';

export type Question = { q: string; a: string };
export type ModuleSummary = { week: string; title: string; desc: string; topics: string[] };
export type LessonStep = { time: string; title: string; desc: string };

/** The courses that take applications now: none when registration is closed, null when the list is unknown. */
export function useOpenCourses(): PublicCourse[] | null {
  const { courses } = useContext(PublicContentContext);
  return courses && courses.filter((course) => course.isAcceptingApplications);
}

/** The course the page talks about: the first one that takes applications, else the first listed, else the default. */
export function useCourse(): CourseFacts {
  const { courses } = useContext(PublicContentContext);
  const shown = courses?.find((course) => course.isAcceptingApplications) ?? courses?.[0];
  return shown ? courseFacts(shown) : DEFAULT_COURSE;
}

export function useFigures(): Figures {
  return courseFigures(useCourse());
}

/** The published value of a place if it is valid there, else the default the page was built with. */
function placeOf(site: Record<string, unknown>, key: string): unknown {
  const field = registryField(key);
  return acceptValue(field, site[key]) ?? field.defaultValue;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asLines(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((line): line is string => typeof line === 'string') : [];
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    : [];
}

/** A text, a link, a phone number, the address of a picture: the string of that place, names filled in. */
export function useText(key: string): string {
  const { site } = useContext(PublicContentContext);
  return fillPlaceholders(asText(placeOf(site, key)), useFigures());
}

/** Several places at once (a hook cannot be called in a loop). */
export function useTexts(keys: readonly string[]): string[] {
  const { site } = useContext(PublicContentContext);
  const figures = useFigures();
  return keys.map((key) => fillPlaceholders(asText(placeOf(site, key)), figures));
}

export function useLines(key: string): string[] {
  const { site } = useContext(PublicContentContext);
  const figures = useFigures();
  return asLines(placeOf(site, key)).map((line) => fillPlaceholders(line, figures));
}

export function useQuestions(key: string): Question[] {
  const { site } = useContext(PublicContentContext);
  const figures = useFigures();
  return asRecords(placeOf(site, key)).map((entry) => ({
    q: fillPlaceholders(asText(entry.q), figures),
    a: fillPlaceholders(asText(entry.a), figures),
  }));
}

export function useModules(key: string): ModuleSummary[] {
  const { site } = useContext(PublicContentContext);
  return asRecords(placeOf(site, key)).map((entry) => ({
    week: asText(entry.week),
    title: asText(entry.title),
    desc: asText(entry.desc),
    topics: asLines(entry.topics),
  }));
}

export function useLessonSteps(key: string): LessonStep[] {
  const { site } = useContext(PublicContentContext);
  return asRecords(placeOf(site, key)).map((entry) => ({
    time: asText(entry.time),
    title: asText(entry.title),
    desc: asText(entry.desc),
  }));
}
