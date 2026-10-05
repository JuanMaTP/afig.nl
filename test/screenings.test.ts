import { describe, expect, it } from 'vitest';
import { monthGrids } from '../src/lib/month-grid';
import { groupShowingsByDay, type Showing, startNote } from '../src/lib/screenings';

const showing = (startsAt: string, venueName = 'LAB111'): Showing => ({
  startsAt,
  venueId: 'lab111',
  venueName,
  venueAddress: null,
  billedTitle: 'Digger',
  sourceUrl: 'https://www.lab111.nl/movie/digger/',
  language: null,
  subtitles: 'Dutch',
  ticketUrl: null,
});

// Saturday 3 October 2026, 12:00 in Amsterdam.
const now = new Date('2026-10-03T10:00:00.000Z');

describe('groupShowingsByDay', () => {
  it("groups by the Amsterdam day, with the agenda's labels", () => {
    const days = groupShowingsByDay(
      [
        showing('2026-10-03T18:40:00.000Z'),
        showing('2026-10-03T18:45:00.000Z', 'Eye Filmmuseum'),
        // 00:30 on Sunday in Amsterdam, 22:30 on Saturday in UTC.
        showing('2026-10-03T22:30:00.000Z'),
        showing('2026-10-05T10:00:00.000Z'),
      ],
      now,
    );
    expect(days.map((d) => [d.key, d.label, d.date, d.showings.length])).toEqual([
      ['2026-10-03', 'Today', 'Sat 3 Oct', 2],
      ['2026-10-04', 'Tomorrow', 'Sun 4 Oct', 1],
      ['2026-10-05', 'Mon 5 Oct', null, 1],
    ]);
  });
});

describe('monthGrids, for screenings', () => {
  it('puts each screening on its Amsterdam day', () => {
    const [october] = monthGrids([showing('2026-10-03T22:30:00.000Z'), showing('2026-10-14T19:00:00.000Z')], now);
    const days = october!.weeks.flat();
    expect(days.find((d) => d?.key === '2026-10-04')?.events).toHaveLength(1);
    expect(days.find((d) => d?.key === '2026-10-14')?.events).toHaveLength(1);
    expect(days.find((d) => d?.key === '2026-10-03')).toMatchObject({ isToday: true, events: [] });
  });
});

describe('startNote', () => {
  it('says what the time is where it isn’t the film’s start, and nothing elsewhere', () => {
    expect(startNote('melkweg')).toMatch(/evening starts/);
    expect(startNote('lab111')).toBeNull();
  });
});
