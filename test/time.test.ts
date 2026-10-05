import { describe, expect, it } from 'vitest';
import { dayKeyIn, nextDayKey, toUtcIso, wallClockIn, zonedTimeToUtcIso } from '../src/lib/time';

const at = (year: number, month: number, day: number, hour: number, minute = 0) => ({ year, month, day, hour, minute, second: 0 });

describe('toUtcIso', () => {
  it('turns any offset into UTC', () => {
    expect(toUtcIso('2026-10-01T18:10:00+02:00')).toBe('2026-10-01T16:10:00.000Z');
    expect(toUtcIso('2026-11-11T18:00:00+01:00')).toBe('2026-11-11T17:00:00.000Z');
  });

  it('refuses something that is not a date-time', () => {
    expect(() => toUtcIso('Thursday evening')).toThrow(RangeError);
  });
});

describe('zonedTimeToUtcIso', () => {
  it('uses summer time before the last Sunday of October, winter time after', () => {
    expect(zonedTimeToUtcIso(at(2026, 10, 24, 20), 'Europe/Amsterdam')).toBe('2026-10-24T18:00:00.000Z');
    expect(zonedTimeToUtcIso(at(2026, 10, 27, 20), 'Europe/Amsterdam')).toBe('2026-10-27T19:00:00.000Z');
  });

  it('switches back to summer time at the end of March', () => {
    expect(zonedTimeToUtcIso(at(2027, 3, 27, 19, 30), 'Europe/Amsterdam')).toBe('2027-03-27T18:30:00.000Z');
    expect(zonedTimeToUtcIso(at(2027, 3, 29, 19, 30), 'Europe/Amsterdam')).toBe('2027-03-29T17:30:00.000Z');
  });

  it('refuses an unknown time zone', () => {
    expect(() => zonedTimeToUtcIso(at(2026, 10, 1, 18), 'Europe/Atlantis')).toThrow(RangeError);
  });
});

describe('wallClockIn and dayKeyIn', () => {
  it('read the Amsterdam wall clock, across midnight', () => {
    expect(wallClockIn('2026-10-01T16:10:00.000Z', 'Europe/Amsterdam')).toEqual(at(2026, 10, 1, 18, 10));
    expect(dayKeyIn('2026-10-01T22:30:00.000Z', 'Europe/Amsterdam')).toBe('2026-10-02');
    expect(dayKeyIn('2026-11-11T22:30:00.000Z', 'Europe/Amsterdam')).toBe('2026-11-11');
  });
});

describe('nextDayKey', () => {
  it('crosses months and years', () => {
    expect(nextDayKey('2026-10-02')).toBe('2026-10-03');
    expect(nextDayKey('2026-10-31')).toBe('2026-11-01');
    expect(nextDayKey('2026-12-31')).toBe('2027-01-01');
  });
});
