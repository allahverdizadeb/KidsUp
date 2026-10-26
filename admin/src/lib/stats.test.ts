import { describe, expect, it } from 'vitest';
import { applicationsOf, makeCourse } from '../test/fixtures.ts';
import { activeCourse, childAgesText, childNames, flowStats, percent, seatCells } from './stats.ts';

describe('the flow of applications', () => {
  const days = Array.from({ length: 30 }, (_, index) => ({
    day: `2026-10-${String(index + 1).padStart(2, '0')}`,
    applications: index === 29 ? 5 : index === 25 ? 2 : index === 10 ? 3 : 0,
  }));

  it('adds up the month, the last week and the week before', () => {
    const stats = flowStats(days);
    expect(stats.total).toBe(10);
    expect(stats.week).toBe(7); // days 24-30: 2 + 5
    expect(stats.previousWeek).toBe(0);
    expect(stats.max).toBe(5);
    expect(stats.average).toBeCloseTo(10 / 30);
    expect(stats.days[0]).toBe('2026-10-01');
  });

  it('never lets the tallest bar be lower than four, so a quiet month does not look busy', () => {
    expect(flowStats([{ day: '2026-10-01', applications: 1 }]).max).toBe(4);
  });

  it('copes with no days at all', () => {
    expect(flowStats([])).toMatchObject({ total: 0, week: 0, previousWeek: 0, average: 0, max: 4 });
  });

  it('counts the week before from the seven days that precede the last seven', () => {
    const busy = Array.from({ length: 14 }, (_, index) => ({
      day: `2026-10-${index + 1}`,
      applications: index < 7 ? 1 : 2,
    }));
    expect(flowStats(busy)).toMatchObject({ week: 14, previousWeek: 7 });
  });
});

describe('small helpers', () => {
  it('takes a share of a whole and never divides by nothing', () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(3, 0)).toBe(0);
  });

  it('finds the course the form is tied to', () => {
    const open = makeCourse({ id: 'b', registration_open: true });
    expect(activeCourse([makeCourse({ id: 'a', registration_open: false }), open])).toBe(open);
    expect(activeCourse([makeCourse({ registration_open: false })])).toBeNull();
    expect(activeCourse([])).toBeNull();
  });

  it('writes the children of an application for a line of text', () => {
    const [application] = applicationsOf(['new']);
    expect(childNames(application!)).toBe('Murad Test');
    expect(childAgesText(application!)).toBe('10 yaş');
    const two = {
      children: [
        ...application!.children,
        { ...application!.children[0]!, name: 'Ayan', age_at_course_start: 8 },
      ],
    };
    expect(childNames(two)).toBe('Murad Test, Ayan');
    expect(childAgesText(two)).toBe('10, 8 yaş');
  });
});

describe('the seats of a course for the grid', () => {
  const course = (taken: number, undecided: number, capacity = 6) =>
    makeCourse({
      capacity,
      seats: {
        capacity,
        approved_children: taken,
        free_seats: capacity - taken,
        applications: { new: undecided, contacted: 0, approved: 0, declined: 0 },
      },
    });

  it('shows the taken seats, then one waiting seat for each undecided application, then the empty ones', () => {
    expect(seatCells(course(2, 2))).toEqual(['taken', 'taken', 'waiting', 'waiting', 'empty', 'empty']);
  });

  it('shows no more waiting seats than are free', () => {
    expect(seatCells(course(5, 4))).toEqual(['taken', 'taken', 'taken', 'taken', 'taken', 'waiting']);
    expect(seatCells(course(6, 3))).toEqual(Array(6).fill('taken'));
  });

  it('draws at most a hundred seats', () => {
    expect(seatCells(course(0, 0, 500))).toHaveLength(100);
  });
});
