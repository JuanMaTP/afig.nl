// Stores a cinema's read in the screenings index and matches its films to TMDB (plan §5.7, §9 Cinema reads).
// A complete read replaces the cinema's screenings in one batch; an incomplete one keeps the last ones and
// is recorded, so admin can flag it. Searches read this index, never the cinemas.
import { eq, inArray, isNull, ne, or } from 'drizzle-orm';
import type { Database } from '../db';
import { billedFilms, cinemaReads, screenings } from '../db/schema';
import { matchFilm } from '../films/match';
import { saveFilm } from '../films/store';
import { type Tmdb, TmdbError } from '../tmdb/client';
import type { BilledFilm } from './cinema';
import type { CinemaRead } from './read';

/** D1 allows 100 bound parameters a query; a screening row binds 4. */
const SCREENINGS_PER_INSERT = 25;

export interface StoredRead {
  complete: boolean;
  films: number;
  screenings: number;
  problems: string[];
}

export async function storeCinemaRead(db: Database, venueId: string, read: CinemaRead, now: Date): Promise<StoredRead> {
  const readAt = now.toISOString();
  const count = read.films.reduce((n, film) => n + film.screenings.length, 0);
  const record = { readAt, complete: read.complete, films: read.films.length, screenings: count, problems: read.problems.join('\n') || null };
  if (!read.complete) {
    await db.insert(cinemaReads).values({ venueId, ...record }).onConflictDoUpdate({ target: cinemaReads.venueId, set: record });
    return { complete: false, films: read.films.length, screenings: count, problems: read.problems };
  }

  const ids: number[] = [];
  for (const film of read.films) ids.push(await upsertBilledFilm(db, venueId, film, readAt));

  const rows = read.films.flatMap((film, i) =>
    film.screenings.map((s) => ({ billedFilmId: ids[i]!, startsAt: s.startsAt, subtitles: s.subtitles, ticketUrl: s.ticketUrl })),
  );
  const inserts = [];
  for (let i = 0; i < rows.length; i += SCREENINGS_PER_INSERT) inserts.push(db.insert(screenings).values(rows.slice(i, i + SCREENINGS_PER_INSERT)));
  const stored = { ...record, storedAt: readAt };
  await db.batch([
    // A subquery, not a list of ids: D1 allows 100 bound parameters a query, and Eye alone has some 120 films.
    db.delete(screenings).where(inArray(screenings.billedFilmId, db.select({ id: billedFilms.id }).from(billedFilms).where(eq(billedFilms.venueId, venueId)))),
    ...inserts,
    db.insert(cinemaReads).values({ venueId, ...stored }).onConflictDoUpdate({ target: cinemaReads.venueId, set: stored }),
  ]);
  return { complete: true, films: read.films.length, screenings: rows.length, problems: read.problems };
}

async function upsertBilledFilm(db: Database, venueId: string, film: BilledFilm, seenAt: string): Promise<number> {
  const fields = {
    title: film.title,
    searchTitle: film.clues.titles[0] ?? null,
    year: film.clues.year,
    directors: film.clues.directors,
    runtime: film.runtime,
    language: film.language,
    subtitles: film.subtitles,
    cluesHash: await cluesHash(film),
    lastSeenAt: seenAt,
  };
  const [row] = await db
    .insert(billedFilms)
    .values({ venueId, sourceUrl: film.sourceUrl, ...fields })
    .onConflictDoUpdate({ target: [billedFilms.venueId, billedFilms.sourceUrl], set: fields })
    .returning({ id: billedFilms.id });
  return row!.id;
}

export interface MatchSummary {
  checked: number;
  matched: number;
  unmatched: Record<string, number>;
  error?: string;
}

/** Matches the films whose clues changed since their last match. A TMDB failure stops it; they wait for the next run. */
export async function matchBilledFilms(db: Database, tmdb: Tmdb, now: Date, limit: number): Promise<MatchSummary> {
  const summary: MatchSummary = { checked: 0, matched: 0, unmatched: {} };
  const pending = await db
    .select()
    .from(billedFilms)
    .where(or(isNull(billedFilms.filmCheckedHash), ne(billedFilms.filmCheckedHash, billedFilms.cluesHash)))
    .limit(limit);
  try {
    for (const film of pending) {
      const clues = { titles: film.searchTitle ? [film.searchTitle] : [], year: film.year, directors: film.directors };
      const result = await matchFilm(tmdb, clues);
      const saved = 'film' in result ? await saveFilm(db, result.film, now) : null;
      const filmId = saved && 'id' in saved ? saved.id : null;
      const problem = 'problem' in result ? result.problem : saved && 'problem' in saved ? saved.problem : null;
      await db
        .update(billedFilms)
        .set({ filmId, filmCheckedHash: film.cluesHash, filmMatchProblem: problem })
        .where(eq(billedFilms.id, film.id));
      summary.checked++;
      if (filmId !== null) summary.matched++;
      if (problem) summary.unmatched[problem] = (summary.unmatched[problem] ?? 0) + 1;
    }
  } catch (error) {
    if (!(error instanceof TmdbError)) throw error;
    summary.error = error.message;
  }
  return summary;
}

async function cluesHash(film: BilledFilm): Promise<string> {
  const content = JSON.stringify([film.clues.titles, film.clues.year, film.clues.directors]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
