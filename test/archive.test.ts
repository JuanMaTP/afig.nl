import { describe, expect, it } from 'vitest';
import { archiveFigures, groupByMonth } from '../src/lib/archive';
import { eventAt } from './events';

const past = (id: string, startsAt: string, venueName: string | null) => eventAt(id, startsAt, { venueName });

// Latest first, as the archive lists them.
const archive = [
  past('river', '2026-10-01T16:10:00.000Z', 'FilmHallen'),
  past('late', '2026-09-30T22:30:00.000Z', 'LAB111'), // 00:30 on 1 October in Amsterdam
  past('perfect', '2026-09-12T16:00:00.000Z', 'LAB111'),
  past('first', '2024-10-10T17:00:00.000Z', null),
];

describe('groupByMonth', () => {
  it('groups by Amsterdam month, keeping the order', () => {
    expect(groupByMonth(archive).map((m) => [m.key, m.label, m.events.map((e) => e.id)])).toEqual([
      ['2026-10', 'October 2026', ['river', 'late']],
      ['2026-09', 'September 2026', ['perfect']],
      ['2024-10', 'October 2024', ['first']],
    ]);
  });
});

describe('archiveFigures', () => {
  it('counts events and real venues, and gives the first month', () => {
    expect(archiveFigures(archive)).toEqual({ events: 4, venues: 2, since: 'October 2024' });
  });

  it('has nothing to count without events', () => {
    expect(archiveFigures([])).toEqual({ events: 0, venues: 0, since: null });
  });
});
