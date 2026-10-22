import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeCourse, withContent } from '../test/publicContent';
import {
  useCourse,
  useFigures,
  useLessonSteps,
  useLines,
  useModules,
  useOpenCourses,
  useQuestions,
  useText,
  useTexts,
} from './usePublicContent';

const OPEN = makeCourse({ id: '00000000-0000-4000-8000-000000000011', title: 'Açıq', priceMinor: 70_000 });
const FULL = makeCourse({
  id: '00000000-0000-4000-8000-000000000022',
  title: 'Dolu',
  priceMinor: 90_000,
  isAcceptingApplications: false,
  seatsLeft: 0,
});

describe('useOpenCourses', () => {
  it('is null while the list is unknown, so the page does not claim registration is closed', () => {
    const { result } = renderHook(() => useOpenCourses(), { wrapper: withContent({ courses: null }) });

    expect(result.current).toBeNull();
  });

  it('is empty when nothing takes applications and keeps only the courses that do', () => {
    const none = renderHook(() => useOpenCourses(), { wrapper: withContent({ courses: [FULL] }) });
    const some = renderHook(() => useOpenCourses(), { wrapper: withContent({ courses: [FULL, OPEN] }) });

    expect(none.result.current).toEqual([]);
    expect(some.result.current).toEqual([OPEN]);
  });
});

describe('useCourse and useFigures', () => {
  it('describe the built-in programme when the list is unknown or empty', () => {
    for (const courses of [null, []]) {
      const { result } = renderHook(() => ({ course: useCourse(), figures: useFigures() }), {
        wrapper: withContent({ courses }),
      });

      expect(result.current.course.priceMinor).toBe(65_000);
      expect(result.current.figures.price).toBe('650 AZN');
      expect(result.current.figures.start_date).toBe('5 dekabr 2026');
    }
  });

  it('describe the first course that takes applications', () => {
    const { result } = renderHook(() => ({ course: useCourse(), figures: useFigures() }), {
      wrapper: withContent({ courses: [FULL, OPEN] }),
    });

    expect(result.current.course.priceMinor).toBe(70_000);
    expect(result.current.figures.price).toBe('700 AZN');
  });

  it('describe the first listed course when none takes applications any more', () => {
    const { result } = renderHook(() => useFigures(), { wrapper: withContent({ courses: [FULL] }) });

    expect(result.current.price).toBe('900 AZN');
  });
});

describe('useText', () => {
  it('is the built-in text until something valid is published', () => {
    const none = renderHook(() => useText('hero.primary_cta'), { wrapper: withContent() });
    const bad = renderHook(() => useText('hero.primary_cta'), {
      wrapper: withContent({ site: { 'hero.primary_cta': 42 } }),
    });
    const empty = renderHook(() => useText('hero.primary_cta'), {
      wrapper: withContent({ site: { 'hero.primary_cta': '' } }),
    });

    expect(none.result.current).not.toBe('');
    expect(bad.result.current).toBe(none.result.current);
    expect(empty.result.current).toBe(none.result.current);
  });

  it('is the published text, with the figures of the course filled in', () => {
    const wrapper = withContent({
      courses: [OPEN],
      site: { 'hero.subtitle': 'Cəmi {price}, {capacity} yer, {start_date}. {unknown} qalır.' },
    });

    const { result } = renderHook(() => useText('hero.subtitle'), { wrapper });

    expect(result.current).toBe('Cəmi 700 AZN, 20 yer, 5 dekabr 2026. {unknown} qalır.');
  });

  it('refuses a link that is not safe and shows the built-in one instead', () => {
    const safe = renderHook(() => useText('founder.linkedin'), { wrapper: withContent() });
    const hostile = renderHook(() => useText('founder.linkedin'), {
      wrapper: withContent({ site: { 'founder.linkedin': 'javascript:alert(1)' } }),
    });

    expect(hostile.result.current).toBe(safe.result.current);
    expect(hostile.result.current).toMatch(/^https:\/\//);
  });

  it('is not affected by keys named like the parts of every object (a tampered file, parsed from JSON)', () => {
    const hostile: Record<string, unknown> = JSON.parse(
      '{"__proto__": {"hero.primary_cta": "polluted"}, "constructor": "x", "toString": "y", "hasOwnProperty": 1}',
    );
    const none = renderHook(() => useText('hero.primary_cta'), { wrapper: withContent() });

    const { result } = renderHook(() => useText('hero.primary_cta'), {
      wrapper: withContent({ site: hostile }),
    });

    expect(result.current).toBe(none.result.current);
    expect(({} as Record<string, unknown>)['hero.primary_cta']).toBeUndefined(); // nothing leaked into Object
  });

  it('fails loudly for a place that does not exist, because that is a mistake in the code', () => {
    expect(() => renderHook(() => useText('no.such.place'), { wrapper: withContent() })).toThrow(
      'No place on the page is called no.such.place.',
    );
  });
});

describe('useTexts', () => {
  it('returns one text per place, in order', () => {
    const wrapper = withContent({ site: { 'hero.primary_cta': 'Bir', 'hero.secondary_cta': 'İki' } });

    const { result } = renderHook(() => useTexts(['hero.primary_cta', 'hero.secondary_cta']), { wrapper });

    expect(result.current).toEqual(['Bir', 'İki']);
  });
});

describe('useLines', () => {
  it('is the published list of lines, each with the figures filled in', () => {
    const wrapper = withContent({
      courses: [OPEN],
      site: { 'demo_day.items': ['Qiymət {price}', 'Yer {capacity}'] },
    });

    const { result } = renderHook(() => useLines('demo_day.items'), { wrapper });

    expect(result.current).toEqual(['Qiymət 700 AZN', 'Yer 20']);
  });

  it('falls back to the built-in lines when the published ones are not all texts', () => {
    const published = renderHook(() => useLines('demo_day.items'), {
      wrapper: withContent({ site: { 'demo_day.items': ['Bir', 2] } }),
    });
    const builtIn = renderHook(() => useLines('demo_day.items'), { wrapper: withContent() });

    expect(published.result.current).toEqual(builtIn.result.current);
    expect(builtIn.result.current.length).toBeGreaterThan(0);
  });
});

describe('useQuestions, useModules and useLessonSteps', () => {
  it('return the published questions with the figures filled in', () => {
    const wrapper = withContent({
      courses: [OPEN],
      site: { 'faq.items': [{ q: '{price} nədir?', a: 'Bu {price_second} deyil.' }] },
    });

    const { result } = renderHook(() => useQuestions('faq.items'), { wrapper });

    expect(result.current).toEqual([{ q: '700 AZN nədir?', a: 'Bu 500 AZN deyil.' }]);
  });

  it('return the built-in questions when the published ones are malformed', () => {
    const malformed = renderHook(() => useQuestions('faq.items'), {
      wrapper: withContent({ site: { 'faq.items': [{ q: 'yalnız sual' }] } }),
    });
    const builtIn = renderHook(() => useQuestions('faq.items'), { wrapper: withContent() });

    expect(malformed.result.current).toEqual(builtIn.result.current);
    expect(builtIn.result.current.length).toBeGreaterThan(1);
  });

  it('return the built-in modules (six) and lesson steps (eight)', () => {
    const modules = renderHook(() => useModules('modules.items'), { wrapper: withContent() });
    const steps = renderHook(() => useLessonSteps('lesson.items'), { wrapper: withContent() });

    expect(modules.result.current).toHaveLength(6);
    expect(modules.result.current[0]?.topics.length).toBeGreaterThan(0);
    expect(steps.result.current).toHaveLength(8);
    expect(steps.result.current[0]).toEqual(
      expect.objectContaining({ time: expect.any(String), title: expect.any(String) }),
    );
  });

  it('return the published modules and lesson steps', () => {
    const module = { week: '1', title: 'Başlıq', desc: 'Təsvir', topics: ['a'] };
    const step = { time: '10:00', title: 'Addım', desc: 'Təsvir' };
    const site = {
      'modules.items': [1, 2, 3, 4, 5, 6].map(() => module),
      'lesson.items': [1, 2, 3, 4, 5, 6, 7, 8].map(() => step),
    };

    const modules = renderHook(() => useModules('modules.items'), { wrapper: withContent({ site }) });
    const steps = renderHook(() => useLessonSteps('lesson.items'), { wrapper: withContent({ site }) });

    expect(modules.result.current[5]).toEqual(module);
    expect(steps.result.current[7]).toEqual(step);
  });

  it('refuse a list with the wrong number of items', () => {
    const site = { 'modules.items': [{ week: '1', title: 'Bir', desc: 'x', topics: ['a'] }] };

    const { result } = renderHook(() => useModules('modules.items'), { wrapper: withContent({ site }) });

    expect(result.current).toHaveLength(6);
    expect(result.current.map((module) => module.title)).not.toContain('Bir');
  });
});
