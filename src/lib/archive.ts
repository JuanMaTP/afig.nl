// The archive of past events (plan §5.2): grouped by month, with a few figures for newcomers.
// It holds every event the ingest has seen since it started; the backfill of the ~190 earlier events
// is a one-time load (plan §5.2) and isn't done yet.
import type { AgendaEvent } from './agenda';
import { formatMonth } from './format';
import { dayKeyIn, SITE_TIME_ZONE } from './time';

export interface ArchiveMonth {
  /** "2026-10" */
  key: string;
  /** "October 2026" */
  label: string;
  events: AgendaEvent[];
}

/** The events grouped by their Amsterdam month, in the order given (the archive lists latest first). */
export function groupByMonth(past: AgendaEvent[]): ArchiveMonth[] {
  const months: ArchiveMonth[] = [];
  for (const event of past) {
    const key = dayKeyIn(event.startsAt, SITE_TIME_ZONE).slice(0, 7);
    let month = months.at(-1);
    if (month?.key !== key) {
      month = { key, label: formatMonth(event.startsAt), events: [] };
      months.push(month);
    }
    month.events.push(event);
  }
  return months;
}

export interface ArchiveFigures {
  events: number;
  /** Real venues: Meetup's several ids for one cinema count once (through the venue aliases). */
  venues: number;
  /** The month of the earliest event, "October 2024"; null without events. */
  since: string | null;
}

export function archiveFigures(past: AgendaEvent[]): ArchiveFigures {
  const venues = new Set(past.flatMap((e) => (e.venue ? [e.venue.name.toLowerCase()] : [])));
  const earliest = past.reduce<string | null>((first, e) => (first === null || e.startsAt < first ? e.startsAt : first), null);
  return { events: past.length, venues: venues.size, since: earliest && formatMonth(earliest) };
}
