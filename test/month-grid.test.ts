import { describe, expect, it } from 'vitest';
import { monthGrids } from '../src/lib/month-grid';
import { eventAt } from './events';

const event = (id: string, startsAt: string) => eventAt(id, startsAt);

const now = new Date('2026-10-02T10:00:00.000Z'); // Friday 2 October, in Amsterdam

describe('monthGrids', () => {
  it('lays out a month in weeks from Monday', () => {
    const [october] = monthGrids([event('a', '2026-10-11T16:30:00.000Z')], now);
    expect(october?.label).toBe('October 2026');
    // 1 October 2026 is a Thursday: three empty cells first. 31 days end on a Saturday: one after.
    expect(october?.weeks[0]?.map((d) => d?.day ?? null)).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(october?.weeks.at(-1)?.map((d) => d?.day ?? null)).toEqual([26, 27, 28, 29, 30, 31, null]);
    expect(october?.weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('puts events on their Amsterdam day, and marks today and the past', () => {
    const agenda = [event('a', '2026-10-02T16:30:00.000Z'), event('b', '2026-10-02T18:00:00.000Z'), event('late', '2026-10-02T22:30:00.000Z')];
    const days = monthGrids(agenda, now)[0]!.weeks.flat();
    const day = (n: number) => days.find((d) => d?.day === n)!;
    expect(day(2)).toMatchObject({ key: '2026-10-02', isToday: true, isPast: false });
    expect(day(2).events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(day(3).events.map((e) => e.id)).toEqual(['late']); // 00:30 on 3 October in Amsterdam
    expect(day(1)).toMatchObject({ isPast: true, isToday: false });
  });

  it('runs from this month to the month of the last event, empty months included', () => {
    const grids = monthGrids([event('a', '2026-10-11T16:30:00.000Z'), event('dune', '2026-12-19T14:00:00.000Z')], now);
    expect(grids.map((g) => g.key)).toEqual(['2026-10', '2026-11', '2026-12']);
  });

  it('crosses a year', () => {
    const december = new Date('2026-12-20T10:00:00.000Z');
    const grids = monthGrids([event('a', '2027-01-05T18:00:00.000Z')], december);
    expect(grids.map((g) => g.label)).toEqual(['December 2026', 'January 2027']);
  });

  it('has no months without events', () => {
    expect(monthGrids([], now)).toEqual([]);
  });
});
