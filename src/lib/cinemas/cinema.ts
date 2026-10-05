// What a cinema reader gives back (plan §5.7, Proposed shape). Each cinema has its own reader, a plain
// module tested against the cinema's real page, trimmed. A version (language, subtitles) is kept only as
// the cinema states it: never a guessed detail (CLAUDE.md).
import type { EventFilmClues } from '../films/event-film';
import { SITE_TIME_ZONE, zonedTimeToUtcIso } from '../time';

/** One film page at a cinema, with its screenings still to come. */
export interface BilledFilm {
  /** The film's page at the cinema: the key for this film at this cinema. */
  sourceUrl: string;
  /** The title as billed, such as "Akira (4K Restoration) (ENG SUBS)". */
  title: string;
  /** What the page says about the film, for matching it to TMDB (src/lib/films/match.ts). */
  clues: EventFilmClues;
  /** In minutes, as stated. */
  runtime: number | null;
  /** The spoken language as stated, in English where the word is known ("Japans" → "Japanese"). */
  language: string | null;
  /** The subtitles as stated for the film; a screening can state its own. */
  subtitles: string | null;
  screenings: BilledScreening[];
}

export interface BilledScreening {
  /** UTC ISO. */
  startsAt: string;
  /** The subtitles this screening states, when it states them. */
  subtitles: string | null;
  ticketUrl: string | null;
}

/** A page that couldn't be read as expected. The cinema's read is then incomplete (src/lib/cinemas/read.ts). */
export class CinemaFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CinemaFormatError';
  }
}

/** A cinema whose programme links a page per film, where the screenings are (Studio/K). */
export interface FilmPagesReader {
  kind: 'film-pages';
  /** The `venues` row. */
  venueId: string;
  origin: string;
  /** The programme page that links every film page. */
  indexUrl: string;
  /** Pages that link films the programme page leaves out, such as those coming later (De Vlugt). */
  moreIndexUrls?: string[];
  filmPageUrls(html: string): string[];
  readFilmPage(html: string, url: string, now: Date): BilledFilm;
}

/** A cinema whose programme page carries every film and screening itself (LAB111): one request a day. */
export interface ProgrammeReader {
  kind: 'programme';
  venueId: string;
  origin: string;
  indexUrl: string;
  /** The programme pages the index links, when the index isn't the programme itself (Cavia: one a month). */
  programmePageUrls?(indexHtml: string): string[];
  /** Throws a CinemaFormatError when the page isn't what it was; a film it can't read is a problem, not a failure. */
  readProgramme(html: string, now: Date, url: string): { films: BilledFilm[]; problems: string[] };
}

export type CinemaReader = FilmPagesReader | ProgrammeReader;

/**
 * The film's title, from the title as billed: without brackets ("(4K Restoration)", "(ENG SUBS)", "(1999)"),
 * a strand after " • " or " | ", or an occasion such as "incl. ramen". The billed title is kept as well.
 */
export function cleanBilledTitle(billed: string): string {
  return billed
    .replace(/^(?:film\s*&\s*food|(?:lgbtq\+\s*)?(?:sneak\s+)?preview|premiere|eng(?:lish)? subs|nl subs|paff)\s*:\s*/i, '')
    // "Needle Drop presents: Daft Punk's Electroma (2006)"
    .replace(/^[^:]{2,40}?\s+presents\s*:\s*/i, '')
    .replace(/\s+[•|]\s+.*$/, '')
    .replace(/\s+incl\.?\s+.*$/i, '')
    .replace(/\([^()]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A month's first three letters, in Dutch and in English: "okt", "Oct" (from "October"). */
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mrt: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12,
};

/**
 * "za 03 okt" or "Monday 26 October" at "19:15", in Amsterdam, as UTC ISO. Cinemas leave out the year: it is
 * the one that puts the date nearest to today, which the system clock gives, never the page (the cinema run's
 * §4, date gate).
 */
export function dayAndTime(day: string, time: string, now: Date): string {
  const date = /(\d{1,2})\s+([a-z]{3})/i.exec(day);
  const clock = /^(\d{1,2})[:.](\d{2})$/.exec(time.trim());
  const month = date ? (MONTHS[date[2]!.toLowerCase()] ?? 0) : 0;
  if (!date || !clock || month === 0) throw new CinemaFormatError(`not a day and time: "${day}" "${time}"`);
  const thisYear = now.getUTCFullYear();
  const candidates = [thisYear - 1, thisYear, thisYear + 1].map((year) =>
    zonedTimeToUtcIso(
      { year, month, day: Number(date[1]), hour: Number(clock[1]), minute: Number(clock[2]), second: 0 },
      SITE_TIME_ZONE,
    ),
  );
  const distance = (iso: string) => Math.abs(new Date(iso).getTime() - now.getTime());
  return candidates.reduce((best, iso) => (distance(iso) < distance(best) ? iso : best));
}

// The languages Dutch cinemas name most, in English. A word not listed stays as the cinema wrote it.
const LANGUAGES: Record<string, string> = {
  arabisch: 'Arabic',
  chinees: 'Chinese',
  deens: 'Danish',
  duits: 'German',
  engels: 'English',
  fins: 'Finnish',
  frans: 'French',
  grieks: 'Greek',
  hebreeuws: 'Hebrew',
  hindi: 'Hindi',
  hongaars: 'Hungarian',
  indonesisch: 'Indonesian',
  italiaans: 'Italian',
  japans: 'Japanese',
  kantonees: 'Cantonese',
  koreaans: 'Korean',
  mandarijn: 'Mandarin',
  nederlands: 'Dutch',
  noors: 'Norwegian',
  pasjtoe: 'Pashto',
  perzisch: 'Persian',
  pools: 'Polish',
  portugees: 'Portuguese',
  roemeens: 'Romanian',
  russisch: 'Russian',
  spaans: 'Spanish',
  thai: 'Thai',
  tsjechisch: 'Czech',
  turks: 'Turkish',
  oekraïens: 'Ukrainian',
  vietnamees: 'Vietnamese',
  zweeds: 'Swedish',
  geen: 'none',
};

/** "Engels" → "English", "Japans, Engels" → "Japanese, English"; an unknown word stays as written. */
export function languageInEnglish(text: string): string {
  return text
    .split(/(\s*(?:,|&|\ben\b|\/)\s*)/)
    .map((part) => LANGUAGES[part.trim().toLowerCase()] ?? (part.trim().toLowerCase() === 'en' ? ' and ' : part))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}
