// Finds the TMDB film a Meetup event or a cinema's film page shows, and only when the match is confident (CLAUDE.md, Film
// matching; plan §9, ingest step 3). A search endpoint always returns something, often the wrong film
// (the cinema run's §3), so a candidate counts only when TMDB's own record agrees with the event:
// - the title: one of the event's titles, squashed, equals TMDB's title, original title or an alternative title;
// - the director: one of TMDB's directors is named in the event's `Directed by` line;
// - the year, when the event states one: TMDB's release year is the same, or one off (festival and release years differ).
// Exactly one film must pass, or exactly one of those that pass must have the very year stated. None, or two
// (a director's remake of their own film, with no year to tell them apart), is no match: a missing poster
// is fine, a wrong one is not. Checked on 3 October 2026 against live TMDB for all 205 stored events: every
// match was the right film.
import type { Tmdb, TmdbMovie, TmdbSearchResult } from '../tmdb/client';
import { releaseYear } from '../tmdb/client';
import { type EventFilmClues, fold, squash } from './event-film';

export type MatchProblem =
  /** No title left to search for once the event title is cleaned. */
  | 'no-title'
  /** No `Directed by` line: the director is what tells a title's films apart. */
  | 'no-director'
  | 'no-match'
  | 'ambiguous';

export type MatchResult = { film: TmdbMovie } | { problem: MatchProblem };

/** How many search results to open, per event. They come in TMDB's order of relevance. */
const MAX_CANDIDATES = 5;
const YEAR_TOLERANCE = 1;

export async function matchFilm(tmdb: Tmdb, clues: EventFilmClues): Promise<MatchResult> {
  if (clues.titles.length === 0) return { problem: 'no-title' };
  if (clues.directors === null) return { problem: 'no-director' };

  const results = new Map<number, TmdbSearchResult>();
  for (const title of clues.titles) for (const r of await tmdb.searchMovies(title)) results.set(r.id, r);
  let candidates = [...results.values()].filter((r) => yearAgrees(clues.year, releaseYear(r.release_date)));
  // A common title can push the right film off the first page; the year narrows the search.
  if (candidates.length === 0 && clues.year !== null) {
    for (const r of await tmdb.searchMovies(clues.titles[0]!, clues.year)) results.set(r.id, r);
    candidates = [...results.values()].filter((r) => yearAgrees(clues.year, releaseYear(r.release_date)));
  }

  const keys = new Set(clues.titles.flatMap(titleKeys));
  // Results whose title already agrees come first; the rest may agree through an alternative title.
  const titled = (r: TmdbSearchResult) => [r.title, r.original_title].flatMap(titleKeys).some((k) => keys.has(k));
  candidates = [...candidates.filter(titled), ...candidates.filter((r) => !titled(r))];
  const agreeing: TmdbMovie[] = [];
  for (const candidate of candidates.slice(0, MAX_CANDIDATES)) {
    const film = await tmdb.movie(candidate.id);
    if (!film || !yearAgrees(clues.year, film.year)) continue;
    const filmKeys = [film.title, film.originalTitle, ...film.alternativeTitles].flatMap(titleKeys);
    if (filmKeys.some((k) => keys.has(k)) && namesADirector(clues.directors, film.directors)) agreeing.push(film);
  }

  if (agreeing.length === 0) return { problem: 'no-match' };
  if (agreeing.length === 1) return { film: agreeing[0]! };
  // In the Mood for Love (2000) and Wong Kar-wai's short "@ in the mood for love" (2001) both agree with
  // "2000": only the film has the very year stated.
  const exact = agreeing.filter((film) => film.year === clues.year);
  return exact.length === 1 ? { film: exact[0]! } : { problem: 'ambiguous' };
}

function yearAgrees(stated: number | null, release: number | null): boolean {
  if (stated === null) return true;
  return release !== null && Math.abs(stated - release) <= YEAR_TOLERANCE;
}

/** The squashed title, and without a leading article: "The Big Lebowski" → "thebiglebowski", "biglebowski". */
function titleKeys(title: string): string[] {
  const words = fold(title).trim();
  const keys = [squash(words), squash(words.replace(/^(the|a|an|de|het|een|le|la|les|l'|il|el|los|las)\b\s*/, ''))];
  return keys.filter((k) => k.length > 0);
}

/**
 * Whether the event's director line names one of TMDB's directors: the whole name, or its first and last
 * word ("Alejandro G. Iñárritu" names Alejandro González Iñárritu). Accents, case and punctuation don't count.
 */
export function namesADirector(line: string, directors: string[]): boolean {
  const said = ` ${words(line).join(' ')} `;
  return directors.some((director) => {
    const name = words(director);
    if (name.length === 0) return false;
    if (said.includes(` ${name.join(' ')} `)) return true;
    return name.length > 1 && said.includes(` ${name[0]} `) && said.includes(` ${name[name.length - 1]} `);
  });
}

function words(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
