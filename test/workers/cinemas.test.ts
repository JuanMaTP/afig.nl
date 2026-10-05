import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../src/cloudflare';
import type { BilledFilm } from '../../src/lib/cinemas/cinema';
import { matchBilledFilms, storeCinemaRead } from '../../src/lib/cinemas/store';
import { billedFilms, cinemaReads, films, screenings } from '../../src/lib/db/schema';
import { TmdbError } from '../../src/lib/tmdb/client';
import { fakeTmdb, film } from '../films/fake-tmdb';

const db = database();
const now = new Date('2026-10-03T10:00:00.000Z');
const later = new Date('2026-10-04T10:00:00.000Z');

const AKIRA = film(149, 'Akira', 1988, ['Katsuhiro Otomo']);

function billed(slug: string, title: string, starts: string[], more: Partial<BilledFilm> = {}): BilledFilm {
  return {
    sourceUrl: `https://studio-k.nu/film/${slug}/`,
    title,
    clues: { titles: [title.replace(/\s*\(.*$/, '')], year: 1988, directors: 'Katsuhiro Ôtomo' },
    runtime: 124,
    language: 'Japanese',
    subtitles: 'English',
    screenings: starts.map((startsAt) => ({ startsAt, subtitles: null, ticketUrl: `https://kassa.studio-k.nu/#/checkout/${startsAt}` })),
    ...more,
  };
}

const read = (list: BilledFilm[], complete = true) => ({ films: list, problems: complete ? [] : ['https://studio-k.nu/: HTTP 503'], complete });

beforeEach(async () => {
  await db.delete(screenings);
  await db.delete(billedFilms);
  await db.delete(cinemaReads);
  await db.delete(films);
});

describe('storeCinemaRead', () => {
  it("stores the cinema's films and screenings, and records the read", async () => {
    const stored = await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira (ENG SUBS)', ['2026-10-05T18:00:00.000Z', '2026-10-06T18:00:00.000Z'])]), now);
    expect(stored).toEqual({ complete: true, films: 1, screenings: 2, problems: [] });
    expect(await db.select().from(billedFilms)).toMatchObject([
      { venueId: 'studio-k', title: 'Akira (ENG SUBS)', searchTitle: 'Akira', year: 1988, language: 'Japanese', subtitles: 'English' },
    ]);
    expect(await db.select().from(screenings)).toHaveLength(2);
    expect(await db.select().from(cinemaReads)).toMatchObject([{ venueId: 'studio-k', complete: true, films: 1, screenings: 2, storedAt: now.toISOString() }]);
  });

  it("replaces the cinema's screenings with each complete read, keeping the film's row", async () => {
    await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira', ['2026-10-05T18:00:00.000Z']), billed('gone', 'Gone', ['2026-10-05T20:00:00.000Z'])]), now);
    await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira', ['2026-10-07T18:00:00.000Z'])]), later);
    expect((await db.select().from(screenings)).map((s) => s.startsAt)).toEqual(['2026-10-07T18:00:00.000Z']);
    expect(await db.select().from(billedFilms)).toHaveLength(2);
  });

  it('keeps the last screenings when a read is incomplete', async () => {
    await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira', ['2026-10-05T18:00:00.000Z'])]), now);
    const stored = await storeCinemaRead(db, 'studio-k', read([], false), later);
    expect(stored).toMatchObject({ complete: false });
    expect(await db.select().from(screenings)).toHaveLength(1);
    expect(await db.select().from(cinemaReads)).toMatchObject([
      { complete: false, readAt: later.toISOString(), storedAt: now.toISOString(), problems: 'https://studio-k.nu/: HTTP 503' },
    ]);
  });

  it('replaces the screenings of a cinema with more films than a query takes parameters', async () => {
    const many = Array.from({ length: 130 }, (_, i) => billed(`film-${i}`, `Film ${i}`, ['2026-10-05T18:00:00.000Z']));
    expect(await storeCinemaRead(db, 'eye', read(many), now)).toMatchObject({ complete: true, films: 130, screenings: 130 });
    expect(await storeCinemaRead(db, 'eye', read(many.slice(0, 10)), later)).toMatchObject({ screenings: 10 });
    expect(await db.select().from(screenings)).toHaveLength(10);
  });

  it('stores more screenings than one insert can carry', async () => {
    const starts = Array.from({ length: 60 }, (_, i) => new Date(now.getTime() + (i + 1) * 3_600_000).toISOString());
    expect(await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira', starts)]), now)).toMatchObject({ screenings: 60 });
    expect(await db.select().from(screenings)).toHaveLength(60);
  });
});

describe('matchBilledFilms', () => {
  it('matches each film once, and again only when what it says changes', async () => {
    await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira (4K Restoration)', ['2026-10-05T18:00:00.000Z'])]), now);
    expect(await matchBilledFilms(db, fakeTmdb([AKIRA]), now, 10)).toEqual({ checked: 1, matched: 1, unmatched: {} });
    const [row] = await db.select().from(billedFilms);
    const [stored] = await db.select().from(films);
    expect(row).toMatchObject({ filmId: stored!.id, filmMatchProblem: null });

    const tmdb = fakeTmdb([AKIRA]);
    await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira (4K Restoration)', ['2026-10-06T18:00:00.000Z'])]), later);
    expect(await matchBilledFilms(db, tmdb, later, 10)).toMatchObject({ checked: 0 });
    expect(tmdb.requests).toEqual([]);

    await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira (4K Restoration)', [], { clues: { titles: ['Akira'], year: 1988, directors: null } })]), later);
    expect(await matchBilledFilms(db, tmdb, later, 10)).toEqual({ checked: 1, matched: 0, unmatched: { 'no-director': 1 } });
    expect((await db.select().from(billedFilms).where(eq(billedFilms.id, row!.id)))[0]).toMatchObject({ filmId: null });
  });

  it('stops when TMDB fails, leaving the film for the next run', async () => {
    await storeCinemaRead(db, 'studio-k', read([billed('akira', 'Akira', ['2026-10-05T18:00:00.000Z'])]), now);
    const tmdb = fakeTmdb([AKIRA]);
    tmdb.searchMovies = async () => {
      throw new TmdbError('TMDB /search/movie: HTTP 500', 500);
    };
    expect(await matchBilledFilms(db, tmdb, now, 10)).toMatchObject({ checked: 0, error: 'TMDB /search/movie: HTTP 500' });
    expect((await db.select().from(billedFilms))[0]).toMatchObject({ filmCheckedHash: null });
  });
});
