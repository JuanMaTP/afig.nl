// The screening search (plan §5.7): where and when a film plays in Amsterdam, read from the screenings index,
// never from the cinemas. A film's screenings are those of the cinema pages matched to it with confidence;
// a page with the same title that couldn't be matched is shown apart, as "possibly", never as the film.
import { and, asc, count, eq, gt, isNotNull, isNull, min, sql } from 'drizzle-orm';
import type { Database } from './db';
import { billedFilms, cinemaReads, films, screenings, venues } from './db/schema';
import { squash } from './films/event-film';
import { formatDay } from './format';
import { dayKeyIn, nextDayKey, SITE_TIME_ZONE } from './time';

export interface Showing {
  /** The start as the cinema lists it: the film's, except where `startNote` says otherwise. */
  startsAt: string;
  /** The `venues` row. */
  venueId: string;
  venueName: string;
  venueAddress: string | null;
  /** As billed at the cinema. */
  billedTitle: string;
  /** The film's page at the cinema. */
  sourceUrl: string;
  /** As the cinema states them, null when it doesn't. */
  language: string | null;
  subtitles: string | null;
  ticketUrl: string | null;
}

const showingColumns = {
  startsAt: screenings.startsAt,
  venueId: venues.id,
  venueName: venues.name,
  venueAddress: venues.address,
  billedTitle: billedFilms.title,
  sourceUrl: billedFilms.sourceUrl,
  language: billedFilms.language,
  // A screening's own subtitles come first: Studio/K states them per screening.
  subtitles: sql<string | null>`coalesce(${screenings.subtitles}, ${billedFilms.subtitles})`,
  ticketUrl: screenings.ticketUrl,
};

/**
 * What a screening's time is, where it isn't the film's own start: Melkweg lists when the evening starts, usually
 * an intro a quarter of an hour before the film, once the doors (src/lib/cinemas/melkweg.ts). Its schedule is free
 * text, so the film's start isn't read; the page says what the time is instead (CLAUDE.md: never conflate the two).
 */
export function startNote(venueId: string): string | null {
  return venueId === 'melkweg' ? 'The time is when the evening starts, often with an intro before the film.' : null;
}

/** The screenings still to come of a TMDB film. */
export async function showingsOfFilm(db: Database, tmdbId: number, now: Date): Promise<Showing[]> {
  return db
    .select(showingColumns)
    .from(screenings)
    .innerJoin(billedFilms, eq(billedFilms.id, screenings.billedFilmId))
    .innerJoin(films, eq(films.id, billedFilms.filmId))
    .innerJoin(venues, eq(venues.id, billedFilms.venueId))
    .where(and(eq(films.tmdbKind, 'movie'), eq(films.tmdbId, tmdbId), gt(screenings.startsAt, now.toISOString())))
    .orderBy(asc(screenings.startsAt));
}

/**
 * Screenings of cinema pages that match no film yet but carry one of these titles, letters and digits
 * compared ("possibly" this film: the run's containment hits are leads, not verdicts).
 */
export async function possibleShowings(db: Database, titles: string[], now: Date): Promise<Showing[]> {
  const keys = new Set(titles.map(squash).filter((k) => k.length > 0));
  const rows = await db
    .select({ ...showingColumns, searchTitle: billedFilms.searchTitle })
    .from(screenings)
    .innerJoin(billedFilms, eq(billedFilms.id, screenings.billedFilmId))
    .innerJoin(venues, eq(venues.id, billedFilms.venueId))
    .where(and(isNull(billedFilms.filmId), gt(screenings.startsAt, now.toISOString())))
    .orderBy(asc(screenings.startsAt));
  return rows.filter((row) => row.searchTitle && keys.has(squash(row.searchTitle))).map(({ searchTitle: _, ...showing }) => showing);
}

export interface PlayingFilm {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  next: string;
  screenings: number;
}

/** Every matched film with a screening still to come, the soonest first. */
export async function playingNow(db: Database, now: Date): Promise<PlayingFilm[]> {
  const rows = await db
    .select({
      tmdbId: films.tmdbId,
      title: films.title,
      year: films.year,
      posterPath: films.posterPath,
      next: min(screenings.startsAt),
      screenings: count(screenings.id),
    })
    .from(screenings)
    .innerJoin(billedFilms, eq(billedFilms.id, screenings.billedFilmId))
    .innerJoin(films, eq(films.id, billedFilms.filmId))
    .where(and(eq(films.tmdbKind, 'movie'), isNotNull(films.tmdbId), gt(screenings.startsAt, now.toISOString())))
    .groupBy(films.id)
    .orderBy(asc(min(screenings.startsAt)));
  return rows.map((row) => ({ ...row, tmdbId: row.tmdbId!, next: row.next! }));
}

/** The cinemas whose screenings are in the index, with when they were last read in full. */
export async function coveredCinemas(db: Database): Promise<{ name: string; storedAt: string }[]> {
  const rows = await db
    .select({ name: venues.name, storedAt: cinemaReads.storedAt })
    .from(cinemaReads)
    .innerJoin(venues, eq(venues.id, cinemaReads.venueId))
    .where(isNotNull(cinemaReads.storedAt))
    .orderBy(asc(venues.name));
  return rows.map((row) => ({ name: row.name, storedAt: row.storedAt! }));
}

/** The main Amsterdam cinemas the search doesn't read yet (the cinema run's §5), so the page can say so. */
export const NOT_YET_READ = [
  'Eye',
  'LAB111',
  'De Uitkijk',
  'Kriterion',
  'FilmHallen',
  'The Movies',
  'Het Ketelhuis',
  'Cinecenter',
  'Rialto VU',
  'FC Hyena',
  'De Vlugt',
  'The Pulse',
  'De Balie',
  'Pathé',
  'Vue',
];

export interface ShowingDay {
  /** "2026-10-04", the Amsterdam date: the anchor the month view links to. */
  key: string;
  /** "Today", "Tomorrow" or "Sun 4 Oct", as in the agenda. */
  label: string;
  /** "Sat 3 Oct" beside "Today" and "Tomorrow"; null when the label is the date. */
  date: string | null;
  showings: Showing[];
}

/** Showings grouped by their day in Amsterdam, in order, with the agenda's day labels. */
export function groupShowingsByDay(showings: Showing[], now: Date): ShowingDay[] {
  const today = dayKeyIn(now.toISOString(), SITE_TIME_ZONE);
  const tomorrow = nextDayKey(today);
  const days: ShowingDay[] = [];
  for (const showing of showings) {
    const key = dayKeyIn(showing.startsAt, SITE_TIME_ZONE);
    let day = days.at(-1);
    if (day?.key !== key) {
      const relative = key === today ? 'Today' : key === tomorrow ? 'Tomorrow' : null;
      day = { key, label: relative ?? formatDay(showing.startsAt), date: relative ? formatDay(showing.startsAt) : null, showings: [] };
      days.push(day);
    }
    day.showings.push(showing);
  }
  return days;
}
