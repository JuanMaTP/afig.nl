// Reads films from TMDB's API (plan §4, TMDB). Authenticates with the API Read Access Token in a header,
// never in a URL (plan §8, TMDB account and key). The schemas pick the fields the site uses and are
// checked where the data enters (docs/engineering.md, Launch mode 3).
import { z } from 'astro/zod';

const API = 'https://api.themoviedb.org/3';

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

/** TMDB answered with an error, or with something the schemas don't accept. The run stops and tries again later. */
export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'TmdbError';
  }
}

const searchResultSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  original_title: z.string(),
  /** "1992-10-09"; empty when TMDB has no date. */
  release_date: z.string().optional(),
  poster_path: z.string().nullish(),
});

const searchSchema = z.object({ results: z.array(searchResultSchema) });

const movieSchema = z.object({
  id: z.number().int().positive(),
  /** "tt0105265"; null or empty when TMDB has none. */
  imdb_id: z.string().nullish(),
  title: z.string().min(1),
  original_title: z.string(),
  release_date: z.string().optional(),
  runtime: z.number().int().nonnegative().nullish(),
  poster_path: z.string().nullish(),
  backdrop_path: z.string().nullish(),
  credits: z.object({ crew: z.array(z.object({ job: z.string(), name: z.string() })) }),
  alternative_titles: z.object({ titles: z.array(z.object({ title: z.string() })) }),
});

export type TmdbSearchResult = z.infer<typeof searchResultSchema>;

/** A film as the site uses it. */
export interface TmdbMovie {
  id: number;
  imdbId: string | null;
  title: string;
  originalTitle: string;
  /** Every other title TMDB knows, such as translations. Used only to match, never shown. */
  alternativeTitles: string[];
  year: number | null;
  directors: string[];
  runtime: number | null;
  posterPath: string | null;
  backdropPath: string | null;
}

export interface Tmdb {
  /** The first page of TMDB's search, which matches original, translated and alternative titles. */
  searchMovies(query: string, year?: number): Promise<TmdbSearchResult[]>;
  /** Null when TMDB has no film with this id (any more). */
  movie(id: number): Promise<TmdbMovie | null>;
}

export function tmdbClient(fetchFn: Fetch, token: string): Tmdb {
  async function get(path: string, params: Record<string, string>): Promise<unknown | null> {
    const url = `${API}${path}?${new URLSearchParams({ language: 'en-US', ...params })}`;
    let response: Response;
    try {
      response = await fetchFn(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    } catch (error) {
      throw new TmdbError(`TMDB ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (response.status === 404) return null;
    if (!response.ok) throw new TmdbError(`TMDB ${path}: HTTP ${response.status}`, response.status);
    return response.json();
  }

  function parse<T>(schema: z.ZodType<T>, data: unknown, path: string): T {
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new TmdbError(`TMDB ${path}: unexpected response (${parsed.error.issues[0]?.message})`);
    return parsed.data;
  }

  return {
    async searchMovies(query, year) {
      const params: Record<string, string> = { query, include_adult: 'false', page: '1' };
      if (year !== undefined) params.year = String(year);
      const data = await get('/search/movie', params);
      return data === null ? [] : parse(searchSchema, data, '/search/movie').results;
    },

    async movie(id) {
      const path = `/movie/${id}`;
      const data = await get(path, { append_to_response: 'credits,alternative_titles' });
      if (data === null) return null;
      const movie = parse(movieSchema, data, path);
      return {
        id: movie.id,
        imdbId: movie.imdb_id && /^tt\d+$/.test(movie.imdb_id) ? movie.imdb_id : null,
        title: movie.title,
        originalTitle: movie.original_title,
        alternativeTitles: movie.alternative_titles.titles.map((t) => t.title),
        year: releaseYear(movie.release_date),
        directors: [...new Set(movie.credits.crew.filter((c) => c.job === 'Director').map((c) => c.name))],
        runtime: movie.runtime || null,
        posterPath: movie.poster_path || null,
        backdropPath: movie.backdrop_path || null,
      };
    },
  };
}

/** "1992-10-09" → 1992; null for an empty or missing date. */
export function releaseYear(date: string | undefined): number | null {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date ?? '');
  return match ? Number(match[1]) : null;
}
