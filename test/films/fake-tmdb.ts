// A stand-in for TMDB in tests. The films are written by hand, with made-up ids and image paths: TMDB's
// Terms forbid keeping its data longer than six months (plan §4), so no TMDB response is stored in the repo.
// The titles, years and directors are the films' public facts.
import { squash } from '../../src/lib/films/event-film';
import type { Tmdb, TmdbMovie } from '../../src/lib/tmdb/client';

export function film(id: number, title: string, year: number | null, directors: string[], more: Partial<TmdbMovie> = {}): TmdbMovie {
  return {
    id,
    imdbId: `tt${String(id).padStart(7, '0')}`,
    title,
    originalTitle: title,
    alternativeTitles: [],
    year,
    directors,
    runtime: 100,
    posterPath: `/poster-${id}.jpg`,
    backdropPath: `/backdrop-${id}.jpg`,
    ...more,
  };
}

/** Searches like TMDB, roughly: every film one of whose titles contains the query, in the order given. */
export function fakeTmdb(catalogue: TmdbMovie[]): Tmdb & { requests: string[] } {
  const requests: string[] = [];
  return {
    requests,
    async searchMovies(query, year) {
      requests.push(`search ${query}${year ? ` ${year}` : ''}`);
      const q = squash(query);
      return catalogue
        .filter((f) => [f.title, f.originalTitle, ...f.alternativeTitles].some((t) => squash(t).includes(q)))
        .filter((f) => year === undefined || f.year === year)
        .map((f) => ({ id: f.id, title: f.title, original_title: f.originalTitle, release_date: f.year ? `${f.year}-06-01` : '' }));
    },
    async movie(id) {
      requests.push(`movie ${id}`);
      return catalogue.find((f) => f.id === id) ?? null;
    },
  };
}
