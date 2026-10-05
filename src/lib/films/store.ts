// Links events to their films and keeps the films' TMDB data fresh (plan §9, ingest step 3; plan §4, TMDB).
// Runs after the Meetup read, a few events at a time, so the archive's past events are matched over
// the first runs without one run doing hundreds of lookups. An event is matched again only when its
// content changes. When TMDB fails, the run stops and the events wait for the next one.
import { and, eq, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { Database } from '../db';
import { events, films } from '../db/schema';
import { type Tmdb, TmdbError, type TmdbMovie } from '../tmdb/client';
import { readEventFilm } from './event-film';
import { matchFilm, type MatchProblem } from './match';

/** Events matched per run. At most 7 TMDB requests each, so about 175 a run. */
export const EVENTS_PER_RUN = 25;
export const FILMS_REFRESHED_PER_RUN = 25;
/** TMDB's Terms forbid keeping its data longer than six months; refresh well before. */
export const REFRESH_AFTER_DAYS = 150;

export interface FilmsSummary {
  checked: number;
  matched: number;
  unmatched: Partial<Record<FilmProblem, number>>;
  refreshed: number;
  /** Set when TMDB failed and the run stopped. */
  error?: string;
}

export type FilmProblem =
  | MatchProblem
  /** TMDB gave this film an IMDb id that another stored film already has: a TMDB duplicate, never merged by guess. */
  | 'imdb-duplicate';

export async function runFilms(db: Database, tmdb: Tmdb, now: Date): Promise<FilmsSummary> {
  const summary: FilmsSummary = { checked: 0, matched: 0, unmatched: {}, refreshed: 0 };
  try {
    await matchPendingEvents(db, tmdb, now, summary);
    await refreshStaleFilms(db, tmdb, now, summary);
  } catch (error) {
    if (!(error instanceof TmdbError)) throw error;
    summary.error = error.message;
  }
  return summary;
}

async function matchPendingEvents(db: Database, tmdb: Tmdb, now: Date, summary: FilmsSummary): Promise<void> {
  const pending = await db
    .select({ id: events.id, title: events.title, description: events.description, contentHash: events.contentHash })
    .from(events)
    .where(or(isNull(events.filmCheckedHash), ne(events.filmCheckedHash, events.contentHash)))
    // The events nearest to today first: the agenda's, then the archive's most recent.
    .orderBy(sql`abs(julianday(${events.startsAt}) - julianday(${now.toISOString()}))`)
    .limit(EVENTS_PER_RUN);

  for (const event of pending) {
    const result = await matchFilm(tmdb, readEventFilm(event.title, event.description));
    const saved = 'film' in result ? await saveFilm(db, result.film, now) : null;
    const filmId = saved && 'id' in saved ? saved.id : null;
    const problem: FilmProblem | null = 'problem' in result ? result.problem : saved && 'problem' in saved ? saved.problem : null;
    await db
      .update(events)
      .set({ filmId, filmCheckedHash: event.contentHash, filmMatchProblem: problem })
      .where(eq(events.id, event.id));
    summary.checked++;
    if (filmId !== null) summary.matched++;
    if (problem) summary.unmatched[problem] = (summary.unmatched[problem] ?? 0) + 1;
  }
}

/** Stores a TMDB film, or updates the row it already has. */
export async function saveFilm(db: Database, movie: TmdbMovie, now: Date): Promise<{ id: number } | { problem: 'imdb-duplicate' }> {
  if (movie.imdbId) {
    const [other] = await db
      .select({ id: films.id })
      .from(films)
      .where(and(eq(films.imdbId, movie.imdbId), or(isNull(films.tmdbId), ne(films.tmdbId, movie.id))));
    // TODO(after-launch): a film added from a member's IMDb export, with no TMDB id yet, is completed here instead.
    if (other) return { problem: 'imdb-duplicate' };
  }
  const [row] = await db
    .insert(films)
    .values({ tmdbKind: 'movie', tmdbId: movie.id, ...filmFields(movie, now) })
    .onConflictDoUpdate({ target: [films.tmdbKind, films.tmdbId], set: filmFields(movie, now) })
    .returning({ id: films.id });
  return { id: row!.id };
}

async function refreshStaleFilms(db: Database, tmdb: Tmdb, now: Date, summary: FilmsSummary): Promise<void> {
  const before = new Date(now.getTime() - REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const stale = await db
    .select({ id: films.id, tmdbId: films.tmdbId })
    .from(films)
    .where(and(eq(films.tmdbKind, 'movie'), isNotNull(films.tmdbId), lt(films.refreshedAt, before)))
    .orderBy(films.refreshedAt)
    .limit(FILMS_REFRESHED_PER_RUN);

  for (const film of stale) {
    const movie = await tmdb.movie(film.tmdbId!);
    // TODO(after-launch): a film TMDB removed or merged keeps its old data; flag it in admin and clear it before six months.
    if (!movie) continue;
    await db.update(films).set(filmFields(movie, now)).where(eq(films.id, film.id));
    summary.refreshed++;
  }
}

function filmFields(movie: TmdbMovie, now: Date) {
  return {
    imdbId: movie.imdbId,
    title: movie.title,
    originalTitle: movie.originalTitle,
    year: movie.year,
    directors: movie.directors.join(', ') || null,
    runtime: movie.runtime,
    posterPath: movie.posterPath,
    backdropPath: movie.backdropPath,
    refreshedAt: now.toISOString(),
  };
}
