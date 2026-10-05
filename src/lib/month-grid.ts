// Month grids for a calendar view: weeks from Monday, from this month to the month of the last item. The
// agenda shows its events this way, a film page its screenings. Each day links to its place in the list view.
import type { AgendaEvent } from './agenda';
import { formatMonth } from './format';
import { dayKeyIn, SITE_TIME_ZONE } from './time';

/** Anything with a start: an event, a screening. */
export interface Dated {
  startsAt: string;
}

export interface MonthGrid<T extends Dated = AgendaEvent> {
  /** "2026-10" */
  key: string;
  /** "October 2026" */
  label: string;
  /** Rows of seven, Monday first; null pads the first and last week. */
  weeks: (GridDay<T> | null)[][];
}

export interface GridDay<T extends Dated = AgendaEvent> {
  /** "2026-10-11", the Amsterdam date, as in the list view's day anchors. */
  key: string;
  day: number;
  isToday: boolean;
  isPast: boolean;
  events: T[];
}

export function monthGrids<T extends Dated>(agenda: T[], now: Date): MonthGrid<T>[] {
  if (agenda.length === 0) return [];
  const today = dayKeyIn(now.toISOString(), SITE_TIME_ZONE);
  const byDay = new Map<string, T[]>();
  for (const event of agenda) {
    const key = dayKeyIn(event.startsAt, SITE_TIME_ZONE);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  const last = [...byDay.keys()].sort().at(-1)!;
  // From this month, or from the first event's month if that is earlier (an event still running).
  let [year, month] = [today, ...byDay.keys()].sort()[0]!.split('-').map(Number) as [number, number];
  const [lastYear, lastMonth] = last.split('-').map(Number) as [number, number];

  const grids: MonthGrid<T>[] = [];
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    grids.push(grid(year, month, today, byDay));
    [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
  }
  return grids;
}

function grid<T extends Dated>(year: number, month: number, today: string, byDay: Map<string, T[]>): MonthGrid<T> {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay counts from Sunday; the grid starts on Monday.
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;

  const cells: (GridDay<T> | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${monthKey}-${String(day).padStart(2, '0')}`;
    cells.push({ key, day, isToday: key === today, isPast: key < today, events: byDay.get(key) ?? [] });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (GridDay<T> | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  // Midday on the 15th is inside the month in any time zone.
  return { key: monthKey, label: formatMonth(new Date(Date.UTC(year, month - 1, 15, 12)).toISOString()), weeks };
}
