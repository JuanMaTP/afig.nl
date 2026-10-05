// What a Meetup event says about its film: the titles to search for, the year and the director
// (plan §9, ingest step 3). Hosts write `Directed by:` and `Year:` lines in both description formats
// (plan §4); 195 of the 205 events stored on 3 October 2026 had the first and 165 the second.
import { plainLine } from '../details/description';
import { readTitle } from '../details/title';
import { EK } from './ek';

export interface EventFilmClues {
  /** Titles to search for, the most cleaned first. */
  titles: string[];
  year: number | null;
  /** Everything after "Directed by", as written: names, sometimes followed by a sentence. */
  directors: string | null;
}

// "Directed by: Joel Coen & Ethan Coen", "Directed by Wim Wenders, Perfect Days is…", "Directed: Carlos Saura",
// "Director: …", "Directors: …".
const DIRECTED_BY = /^(?:directed(?:\s+by)?|directors?)\s*:?\s+(.+)$/i;
// "Year: 1992", "Year: 1989, re-release in 2026", "Year: 2025 [JFDB](…)": the first year on the line.
const YEAR_LINE = /^year\s*:\s*\D*?\b(1[89]\d\d|20\d\d)\b/i;
/** Shorter than this without its article, a title is too short to search for: `EK` leaves "the" of "The English Patient (English …)". */
const MIN_KEY_LENGTH = 2;
const LEADING_ARTICLE = /^(?:the|a|an|de|het|een|le|la|les|l'|il|el|los|las)\b\s*/i;
// Hosts add the occasion after the film, where `EK` doesn't look: "Kiki's Delivery Service, Re-release in
// IMAX", "Amadeus & 1,000 Member Celebration", "Christiane F. 45th Anniversary". The shortened titles are
// only searched for: a match still needs the director and the year (src/lib/films/match.ts).
const OCCASION = [/,\s.*$/, /\s+&\s.*$/, /\s+\d{1,3}(?:st|nd|rd|th)\s+anniversary\b.*$/i];
/** One TMDB search each. */
const MAX_TITLES = 4;

export function readEventFilm(title: string, description: string): EventFilmClues {
  const lines = description.split(/\r?\n/).map(plainLine);
  const directors = lines.map((line) => DIRECTED_BY.exec(line)?.[1]?.trim()).filter((d): d is string => !!d);
  const years = lines.map((line) => YEAR_LINE.exec(line)?.[1]).filter((y): y is string => !!y);
  const key = EK(title);

  // "Daytime Cinema | The Teacher Who Promised the Sea (2023)": the film is the last part.
  const parts = [title, ...(title.includes('|') ? [title.slice(title.lastIndexOf('|') + 1)] : [])];
  const titles = parts.flatMap((part) => {
    const plain = readTitle(part).title;
    return [EK(part).disp, plain, ...OCCASION.map((cut) => plain.replace(cut, ''))];
  });

  // One search per distinct title: "a river runs through it" and "A River Runs Through It" are one.
  const distinct = new Map<string, string>();
  for (const t of titles) {
    const key = squash(t);
    if (squash(t.replace(LEADING_ARTICLE, '')).length >= MIN_KEY_LENGTH && !distinct.has(key)) distinct.set(key, t.trim());
  }

  return {
    titles: [...distinct.values()].slice(0, MAX_TITLES),
    // Two different `Year:` lines would mean choosing one: none is safer.
    year: new Set(years).size === 1 ? Number(years[0]) : key.y ? Number(key.y) : null,
    directors: directors.length > 0 ? directors.join(' · ') : null,
  };
}

/** Letters and digits only, lowercase, without accents: "Vive l'amour" → "vivelamour". */
export function squash(text: string): string {
  return fold(text).replace(/[^a-z0-9]+/g, '');
}

// Letters that have no accent to drop, so NFD leaves them: "Ahlat Ağacı" needs ı → i.
const UNACCENTED: Record<string, string> = { ı: 'i', ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', ł: 'l', đ: 'd', ð: 'd', þ: 'th' };

/** Lowercase, without accents, with ı, ø, æ… as Latin letters. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[ıøæœßłđðþ]/g, (c) => UNACCENTED[c]!);
}
