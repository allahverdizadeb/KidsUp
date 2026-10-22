import type { ReactNode } from 'react';
import type { PublicContent, PublicCourse } from '../api/publicContent';
import PublicContentProvider from '../content/PublicContentProvider';

/** A published course for the tests: the programme the page advertises, open, with all its places free. */
export function makeCourse(overrides: Partial<PublicCourse> = {}): PublicCourse {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    title: '6 həftəlik KidsUp proqramı (dekabr 2026)',
    startDate: '2026-12-05',
    schedule: 'şənbə, 09:30–13:00',
    location: 'Bakı, dəqiq ünvan qeydiyyatdan əvvəl bildiriləcək',
    ageMin: 8,
    ageMax: 13,
    priceMinor: 65_000,
    secondChildPriceMinor: 50_000,
    capacity: 20,
    seatsLeft: 20,
    isAcceptingApplications: true,
    ...overrides,
  };
}

/** Wraps a component in what the admin panel published; leave a part out for "nothing published". */
export function withContent(content: Partial<PublicContent> = {}) {
  const value: PublicContent = { site: {}, courses: null, ...content };
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PublicContentProvider content={value}>{children}</PublicContentProvider>;
  };
}
