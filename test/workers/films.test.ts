import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../src/cloudflare';
import { events, films } from '../../src/lib/db/schema';
import { EVENTS_PER_RUN, REFRESH_AFTER_DAYS, runFilms } from '../../src/lib/films/store';
import { TmdbError } from '../../src/lib/tmdb/client';
import { fakeTmdb, film } from '../films/fake-tmdb';

const db = database();
const now = new Date('2026-10-03T12:00:00.000Z');

const RIVER = film(101, 'A River Runs Through It', 1992, ['Robert Redford']);
const PERFECT_DAYS = film(102, 'Perfect Days', 2023, ['Wim Wenders']);

async function addEvent(id: string, title: string, description: string, startsAt = '2026-10-10T17:00:00.000Z') {
  await db.insert(events).values({
    id,
    title,
    url: `https://www.meetup.com/amsterdam-film-group/events/${id}/`,
    startsAt,
    description,
    cancelled: false,
    contentHash: `hash-${id}`,
    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    changedAt: now.toISOString(),
  });
}

const row = async (id: string) => (await db.select().from(events).where(eq(events.id, id)))[0]!;

beforeEach(async () => {
  await db.delete(events);
  await db.delete(films);
});

describe('runFilms', () => {
  it('links each event to its film, and notes why one has none', async () => {
    await addEvent('1', 'A River Runs Through It (English without Subtitles)', 'Directed by: Robert Redford\nYear: 1992');
    await addEvent('2', 'Oldboy', 'A cult classic.');
    await addEvent('3', 'A River Runs Through It', 'Directed by: Robert Redford\nYear: 1992', '2026-11-01T17:00:00.000Z');

    const summary = await runFilms(db, fakeTmdb([RIVER]), now);
    expect(summary).toEqual({ checked: 3, matched: 2, unmatched: { 'no-director': 1 }, refreshed: 0 });

    const [stored] = await db.select().from(films);
    expect(stored).toMatchObject({
      tmdbKind: 'movie',
      tmdbId: 101,
      imdbId: 'tt0000101',
      title: 'A River Runs Through It',
      year: 1992,
      directors: 'Robert Redford',
      posterPath: '/poster-101.jpg',
      refreshedAt: now.toISOString(),
    });
    expect(await row('1')).toMatchObject({ filmId: stored!.id, filmCheckedHash: 'hash-1', filmMatchProblem: null });
    expect(await row('3')).toMatchObject({ filmId: stored!.id });
    expect(await row('2')).toMatchObject({ filmId: null, filmCheckedHash: 'hash-2', filmMatchProblem: 'no-director' });
  });

  it('matches an event again only when its content changes', async () => {
    await addEvent('1', 'Perfect Days', 'Directed by: Wim Wenders\nYear: 2023');
    await runFilms(db, fakeTmdb([PERFECT_DAYS]), now);

    const tmdb = fakeTmdb([PERFECT_DAYS, RIVER]);
    expect(await runFilms(db, tmdb, now)).toMatchObject({ checked: 0 });
    expect(tmdb.requests).toEqual([]);

    // The host changes the film.
    await db
      .update(events)
      .set({ title: 'A River Runs Through It', description: 'Directed by: Robert Redford\nYear: 1992', contentHash: 'hash-1b' })
      .where(eq(events.id, '1'));
    expect(await runFilms(db, tmdb, now)).toMatchObject({ checked: 1, matched: 1 });
    const river = (await db.select().from(films).where(eq(films.tmdbId, 101)))[0]!;
    expect(await row('1')).toMatchObject({ filmId: river.id, filmCheckedHash: 'hash-1b' });
  });

  it('checks the events nearest to today first, a limited number per run', async () => {
    for (let i = 0; i < EVENTS_PER_RUN + 2; i++) {
      const day = new Date(now.getTime() - (i + 1) * 24 * 60 * 60 * 1000).toISOString();
      await addEvent(`past-${i}`, 'Oldboy', 'No director.', day);
    }
    await addEvent('next', 'Oldboy', 'No director.', '2026-10-04T17:00:00.000Z');
    expect(await runFilms(db, fakeTmdb([]), now)).toMatchObject({ checked: EVENTS_PER_RUN });
    expect(await row('next')).toMatchObject({ filmMatchProblem: 'no-director' });
    expect(await row(`past-${EVENTS_PER_RUN + 1}`)).toMatchObject({ filmCheckedHash: null });
  });

  it('stops when TMDB fails, and leaves the event for the next run', async () => {
    await addEvent('1', 'Perfect Days', 'Directed by: Wim Wenders\nYear: 2023');
    const tmdb = fakeTmdb([PERFECT_DAYS]);
    tmdb.searchMovies = async () => {
      throw new TmdbError('TMDB /search/movie: HTTP 429', 429);
    };
    expect(await runFilms(db, tmdb, now)).toMatchObject({ checked: 0, error: 'TMDB /search/movie: HTTP 429' });
    expect(await row('1')).toMatchObject({ filmId: null, filmCheckedHash: null });
  });

  it('never merges two TMDB films that claim one IMDb id', async () => {
    await addEvent('1', 'Perfect Days', 'Directed by: Wim Wenders\nYear: 2023');
    await addEvent('2', 'A River Runs Through It', 'Directed by: Robert Redford\nYear: 1992', '2026-10-11T17:00:00.000Z');
    const duplicate = { ...RIVER, imdbId: PERFECT_DAYS.imdbId };
    const summary = await runFilms(db, fakeTmdb([PERFECT_DAYS, duplicate]), now);
    expect(summary).toMatchObject({ matched: 1, unmatched: { 'imdb-duplicate': 1 } });
    expect(await row('2')).toMatchObject({ filmId: null, filmMatchProblem: 'imdb-duplicate' });
    expect(await db.select().from(films)).toHaveLength(1);
  });

  it('refreshes TMDB data before it is six months old', async () => {
    const old = new Date(now.getTime() - (REFRESH_AFTER_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    await db.insert(films).values([
      { tmdbKind: 'movie', tmdbId: 101, title: 'Old title', refreshedAt: old },
      { tmdbKind: 'movie', tmdbId: 102, title: 'Perfect Days', refreshedAt: recent },
      { imdbId: 'tt9999999', title: 'Only on IMDb' },
    ]);
    expect(await runFilms(db, fakeTmdb([RIVER, PERFECT_DAYS]), now)).toMatchObject({ refreshed: 1 });
    const [river] = await db.select().from(films).where(eq(films.tmdbId, 101));
    expect(river).toMatchObject({ title: 'A River Runs Through It', directors: 'Robert Redford', refreshedAt: now.toISOString() });
  });

  it('keeps a film to TMDB kind and id, or an IMDb id', async () => {
    await expect(db.insert(films).values({ title: 'Nothing to identify it' })).rejects.toThrow();
    await expect(db.insert(films).values({ tmdbId: 5, title: 'An id without its kind' })).rejects.toThrow();
  });
});
