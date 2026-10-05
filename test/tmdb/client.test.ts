// The responses are shaped like TMDB's (checked 3 October 2026) but written by hand, with made-up ids and
// paths: no TMDB data is kept in the repo (plan §4).
import { describe, expect, it } from 'vitest';
import { tmdbClient, TmdbError } from '../../src/lib/tmdb/client';

const movie = {
  adult: false,
  id: 101,
  imdb_id: 'tt0000101',
  title: 'A River Runs Through It',
  original_title: 'A River Runs Through It',
  release_date: '1992-10-09',
  runtime: 123,
  poster_path: '/poster-101.jpg',
  backdrop_path: null,
  overview: 'Two brothers in Montana.',
  credits: {
    cast: [{ name: 'Brad Pitt', character: 'Paul' }],
    crew: [
      { job: 'Director', name: 'Robert Redford' },
      { job: 'Producer', name: 'Robert Redford' },
      { job: 'Screenplay', name: 'Richard Friedenberg' },
    ],
  },
  alternative_titles: { titles: [{ iso_3166_1: 'NL', title: 'In de stroom', type: '' }] },
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetchFn };
}

describe('tmdbClient', () => {
  it('reads a film, its directors and its other titles, with the token in a header', async () => {
    const { calls, fetchFn } = fakeFetch(200, movie);
    expect(await tmdbClient(fetchFn, 'secret').movie(101)).toEqual({
      id: 101,
      imdbId: 'tt0000101',
      title: 'A River Runs Through It',
      originalTitle: 'A River Runs Through It',
      alternativeTitles: ['In de stroom'],
      year: 1992,
      directors: ['Robert Redford'],
      runtime: 123,
      posterPath: '/poster-101.jpg',
      backdropPath: null,
    });
    expect(calls[0]!.url).toBe(
      'https://api.themoviedb.org/3/movie/101?language=en-US&append_to_response=credits%2Calternative_titles',
    );
    expect(calls[0]!.url).not.toContain('secret');
    expect(new Headers(calls[0]!.init.headers).get('authorization')).toBe('Bearer secret');
  });

  it('leaves out an empty IMDb id, date or runtime', async () => {
    const { fetchFn } = fakeFetch(200, { ...movie, imdb_id: '', release_date: '', runtime: 0 });
    expect(await tmdbClient(fetchFn, 'secret').movie(101)).toMatchObject({ imdbId: null, year: null, runtime: null });
  });

  it('searches, with the year when given', async () => {
    const results = [{ id: 101, title: 'A River Runs Through It', original_title: 'A River Runs Through It', release_date: '1992-10-09' }];
    const { calls, fetchFn } = fakeFetch(200, { page: 1, results, total_pages: 1, total_results: 1 });
    expect(await tmdbClient(fetchFn, 'secret').searchMovies('a river runs through it', 1992)).toEqual(results);
    expect(calls[0]!.url).toBe(
      'https://api.themoviedb.org/3/search/movie?language=en-US&query=a+river+runs+through+it&include_adult=false&page=1&year=1992',
    );
  });

  it('answers null for a film TMDB no longer has', async () => {
    const { fetchFn } = fakeFetch(404, { success: false, status_code: 34 });
    expect(await tmdbClient(fetchFn, 'secret').movie(999)).toBeNull();
  });

  it('throws on any other error or an unexpected response, so the run stops', async () => {
    await expect(tmdbClient(fakeFetch(429, {}).fetchFn, 'secret').movie(101)).rejects.toThrow(TmdbError);
    await expect(tmdbClient(fakeFetch(200, { id: 'x' }).fetchFn, 'secret').movie(101)).rejects.toThrow(TmdbError);
    const failing = async () => {
      throw new Error('network down');
    };
    await expect(tmdbClient(failing, 'secret').searchMovies('x')).rejects.toThrow(TmdbError);
  });
});
