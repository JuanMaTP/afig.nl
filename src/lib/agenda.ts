// The events the agenda shows (plan §5.1): every listed event that hasn't ended, soonest first.
// And the archive (plan §5.2): every event that took place, latest first.
// The screening details are read from the title and description when a page renders, not stored:
// a parser fix then reaches every event at once, with no new ingest (plan §8, 2 October 2026).
import { and, asc, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import type { Database } from './db';
import { events, groupStats, venueAliases, venues } from './db/schema';
import { readDescription } from './details/description';
import { describeLanguage, readTitle } from './details/title';
import { formatDay } from './format';
import type { GroupRating } from './meetup/event';
import { dayKeyIn, nextDayKey, SITE_TIME_ZONE, wallClockIn, zonedTimeToUtcIso } from './time';

export interface AgendaEvent {
  id: string;
  /** The title without its language and format brackets (`readTitle`). */
  title: string;
  url: string;
  /** The meetup time, as a UTC ISO string. */
  startsAt: string;
  endsAt: string | null;
  /** The film start, as a UTC ISO string; null when the description doesn't give one that fits the event's times. */
  filmStartsAt: string | null;
  /** "Spanish · English subtitles": from the title's bracket, else the `Language:` line, else "The film is in …". */
  language: string | null;
  /** "4K Restoration", from the title. */
  format: string | null;
  auditorium: string | null;
  ticketsUrl: string | null;
  cancelled: boolean;
  /** The venue through its aliases, or Meetup's own venue name when the Meetup id has no alias yet. */
  venue: { name: string; address: string | null; city: string | null } | null;
  going: number | null;
  rsvpLimit: number | null;
  coverImageUrl: string | null;
}

/** An event as it is read from D1, before its details are read. */
export interface StoredEvent {
  id: string;
  title: string;
  url: string;
  startsAt: string;
  endsAt: string | null;
  description: string;
  cancelled: boolean;
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  meetupVenueName: string | null;
  going: number | null;
  rsvpLimit: number | null;
  coverImageUrl: string | null;
}

/** When an event is over: its end, or its start when Meetup has no end. */
const endsOrStarts = sql<string>`coalesce(${events.endsAt}, ${events.startsAt})`;

/** Every listed event that ends after `endingAfter`, soonest first. The agenda passes now. */
export async function upcomingEvents(db: Database, endingAfter: Date): Promise<AgendaEvent[]> {
  const rows = await storedEvents(db)
    .where(and(isNull(events.unlistedAt), gte(endsOrStarts, endingAfter.toISOString())))
    .orderBy(asc(events.startsAt));
  return rows.map(agendaEvent);
}

/**
 * Every event that has ended, latest first. Cancelled events never took place, and an unlisted one
 * disappeared from Meetup before its date, so neither is in the archive.
 */
export async function pastEvents(db: Database, now: Date): Promise<AgendaEvent[]> {
  const rows = await storedEvents(db)
    .where(and(isNull(events.unlistedAt), eq(events.cancelled, false), lt(endsOrStarts, now.toISOString())))
    .orderBy(desc(events.startsAt));
  return rows.map(agendaEvent);
}

/** The group's average rating on Meetup, as the ingest last read it; null before the first read. */
export async function groupRating(db: Database): Promise<GroupRating | null> {
  const [row] = await db.select({ average: groupStats.ratingAverage, count: groupStats.ratingCount }).from(groupStats).limit(1);
  return row ?? null;
}

/** One listed event by its Meetup id, past or upcoming; null when there is none. */
export async function eventById(db: Database, id: string): Promise<AgendaEvent | null> {
  const [row] = await storedEvents(db)
    .where(and(eq(events.id, id), isNull(events.unlistedAt)))
    .limit(1);
  return row ? agendaEvent(row) : null;
}

function storedEvents(db: Database) {
  return db
    .select({
      id: events.id,
      title: events.title,
      url: events.url,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      description: events.description,
      cancelled: events.cancelled,
      venueName: venues.name,
      venueAddress: venues.address,
      venueCity: venues.city,
      meetupVenueName: events.meetupVenueName,
      going: events.going,
      rsvpLimit: events.rsvpLimit,
      coverImageUrl: events.coverImageUrl,
    })
    .from(events)
    .leftJoin(venueAliases, eq(venueAliases.meetupVenueId, events.meetupVenueId))
    .leftJoin(venues, eq(venues.id, venueAliases.venueId));
}

export function agendaEvent(row: StoredEvent): AgendaEvent {
  const title = readTitle(row.title);
  const details = readDescription(row.description);
  const venueName = row.venueName ?? row.meetupVenueName;
  return {
    id: row.id,
    title: title.title,
    url: row.url,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    filmStartsAt: details.filmStarts && filmStartsAt(details.filmStarts, row.startsAt, row.endsAt),
    language: title.language ?? (details.language ? describeLanguage(details.language) : details.languageSentence),
    format: title.format,
    auditorium: details.auditorium && roomOnly(details.auditorium, [row.venueName, row.meetupVenueName]),
    ticketsUrl: details.ticketsUrl,
    cancelled: row.cancelled,
    venue: venueName ? { name: venueName, address: row.venueAddress, city: row.venueCity } : null,
    going: row.going,
    rsvpLimit: row.rsvpLimit,
    coverImageUrl: row.coverImageUrl,
  };
}

/** The film start on the event's day. One before the meetup or after the end is a misread, so it is left out. */
function filmStartsAt(time: { hour: number; minute: number }, startsAt: string, endsAt: string | null): string | null {
  const day = wallClockIn(startsAt, SITE_TIME_ZONE);
  const iso = zonedTimeToUtcIso({ ...day, hour: time.hour, minute: time.minute, second: 0 }, SITE_TIME_ZONE);
  return iso < startsAt || (endsAt !== null && iso >= endsAt) ? null : iso;
}

/** Null when the "auditorium" is the cinema itself, as in "Theater: LAB111" or "Theater: De Uitkijk". */
function roomOnly(auditorium: string, venueNames: (string | null)[]): string | null {
  const room = comparable(auditorium);
  const isVenue = venueNames.some((name) => {
    if (!name) return false;
    const venue = comparable(name);
    return venue === room || (room.length >= 3 && venue.includes(room)) || (venue.length >= 3 && room.includes(venue));
  });
  return room === '' || isVenue ? null : auditorium;
}

function comparable(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export interface AgendaDay {
  /** "2026-10-02", the Amsterdam date. */
  key: string;
  /** "Today", "Tomorrow" or "Sat 3 Oct". */
  label: string;
  /** "Fri 2 Oct" beside "Today" and "Tomorrow"; null when the label is the date. */
  date: string | null;
  events: AgendaEvent[];
}

/** The events grouped by their Amsterdam day, in the order given. */
export function groupByDay(agenda: AgendaEvent[], now: Date): AgendaDay[] {
  const today = dayKeyIn(now.toISOString(), SITE_TIME_ZONE);
  const tomorrow = nextDayKey(today);
  const days: AgendaDay[] = [];
  for (const event of agenda) {
    const key = dayKeyIn(event.startsAt, SITE_TIME_ZONE);
    let day = days.at(-1);
    if (day?.key !== key) {
      const relative = key === today ? 'Today' : key === tomorrow ? 'Tomorrow' : null;
      day = { key, label: relative ?? formatDay(event.startsAt), date: relative ? formatDay(event.startsAt) : null, events: [] };
      days.push(day);
    }
    day.events.push(event);
  }
  return days;
}
