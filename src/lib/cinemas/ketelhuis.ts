// Het Ketelhuis (www.ketelhuis.nl). robots.txt allows everything, with no Crawl-delay (3 October 2026); terms
// in plan §5.7. `/films/` links every film page (`/films/<slug>/`); `/specials/` are strands, not films. A film
// page has a credits table (`Regie`, `Taal`, `Duur`, `Jaar`) and its screenings as ticket buttons: the first
// day's with a full `datetime` ("2026-10-08 16:15"), the other days' with the time only, under their date.
// Its JSON-LD screenings are wrong (3 October 2026: "2026-10-08T14:15:00+1:00" for a screening the page shows
// on 9 October at 14:15), so they aren't read. The language line carries the subtitles too: "Noors gesproken
// en NL ondertiteld".
import { parseHTML } from 'linkedom';
import {
  type BilledFilm,
  type BilledScreening,
  CinemaFormatError,
  cleanBilledTitle,
  type FilmPagesReader,
  languageInEnglish,
} from './cinema';
import { SITE_TIME_ZONE, zonedTimeToUtcIso } from '../time';

const ORIGIN = 'https://www.ketelhuis.nl';
const FILM_PAGE = /^https:\/\/www\.ketelhuis\.nl\/films\/[a-z0-9-]+\/$/;
const FULL = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;
// "Noors gesproken en NL ondertiteld", "Engels en NL ondertiteld", "Nederlands gesproken en Engels ondertiteld",
// "Frans gesproken, NL ondertiteld": the first group is greedy, so the subtitles are the last part.
const SPOKEN_AND_SUBTITLES = /^(.+)(?:\s+en\s+|\s*[,|]\s*)([^,|]+?)\s+ondertiteld$/i;
// "Engels gesproken | geen ondertiteling", "Engels gesproken, geen ondertiteling"
const NO_SUBTITLES = /^(.+?)\s*[,|]\s*geen ondertiteling$/i;
const SPOKEN_ONLY = /^(.+?)\s+gesproken$/i;
const SHORT_LANGUAGES: Record<string, string> = { nl: 'Dutch', en: 'English', eng: 'English' };

export const ketelhuis: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'het-ketelhuis',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/films/`,

  filmPageUrls(html) {
    const { document } = parseHTML(html);
    const urls = [...document.querySelectorAll('a[href]')].map((a) => (a.getAttribute('href') ?? '').replace(/[?#].*$/, ''));
    return [...new Set(urls.filter((href) => FILM_PAGE.test(href)))];
  },

  readFilmPage(html, url, _now) {
    const { document } = parseHTML(html);
    const title = document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!title) throw new CinemaFormatError(`${url}: no title`);

    const credits = new Map<string, string>();
    for (const row of document.querySelectorAll('.c-detail-info table tr')) {
      const [label, value] = [...row.querySelectorAll('td')].map((td) => td.textContent?.replace(/\s+/g, ' ').trim() ?? '');
      if (label && value && !credits.has(label.toLowerCase())) credits.set(label.toLowerCase(), value);
    }

    const screenings = new Map<string, BilledScreening>();
    for (const button of document.querySelectorAll('a.time[href]')) {
      const value = button.querySelector('time')?.getAttribute('datetime')?.trim() ?? '';
      let parts: number[] | null = null;
      const full = FULL.exec(value);
      if (full) parts = full.slice(1).map(Number);
      else {
        const time = TIME.exec(value);
        const day = DAY.exec(button.closest('li')?.querySelector('.date time')?.getAttribute('datetime') ?? '');
        if (time && day) parts = [...day.slice(1), ...time.slice(1)].map(Number);
      }
      if (!parts) throw new CinemaFormatError(`${url}: a screening without a day and time`);
      const [year, month, day, hour, minute] = parts as [number, number, number, number, number];
      const ticket = button.getAttribute('href') ?? '';
      const startsAt = zonedTimeToUtcIso({ year, month, day, hour, minute, second: 0 }, SITE_TIME_ZONE);
      screenings.set(startsAt, { startsAt, subtitles: null, ticketUrl: /^https:\/\//.test(ticket) ? ticket : null });
    }

    const version = readLanguage(credits.get('taal') ?? '');
    const year = /^(1[89]\d\d|20\d\d)$/.exec(credits.get('jaar') ?? '')?.[1];
    const runtime = /^(\d{1,3})\s*min/.exec(credits.get('duur') ?? '')?.[1];
    return {
      sourceUrl: url,
      title,
      clues: { titles: [cleanBilledTitle(title)].filter(Boolean), year: year ? Number(year) : null, directors: credits.get('regie') ?? null },
      runtime: runtime ? Number(runtime) : null,
      language: version.language,
      subtitles: version.subtitles,
      screenings: [...screenings.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    } satisfies BilledFilm;
  },
};

/**
 * "Noors gesproken en NL ondertiteld" → Norwegian, Dutch subtitles. The subtitles are the last part before
 * "ondertiteld", so "Japans en Frans gesproken en Engels ondertiteld" is Japanese and French with English
 * subtitles (it read as Japanese with "Frans gesproken and English" subtitles until 4 October 2026). A phrasing
 * it doesn't know stays as written, as the language: never a guessed version (CLAUDE.md).
 */
export function readLanguage(line: string): { language: string | null; subtitles: string | null } {
  const text = line.replace(/\s+/g, ' ').trim();
  if (!text) return { language: null, subtitles: null };
  const none = NO_SUBTITLES.exec(text);
  if (none && plain(none[1]!)) return { language: language(spokenPart(none[1]!)), subtitles: 'none' };
  const both = SPOKEN_AND_SUBTITLES.exec(text);
  if (both && plain(both[1]!) && plain(both[2]!) && !/gesproken/i.test(both[2]!)) {
    return { language: language(spokenPart(both[1]!)), subtitles: language(both[2]!) };
  }
  if (both || none) return { language: text, subtitles: null };
  const spoken = SPOKEN_ONLY.exec(text);
  if (spoken) return { language: language(spoken[1]!), subtitles: null };
  return { language: text, subtitles: null };
}

function language(word: string): string {
  return SHORT_LANGUAGES[word.trim().toLowerCase()] ?? languageInEnglish(word);
}

/** "Japans en Frans gesproken" → "Japans en Frans". */
function spokenPart(part: string): string {
  return part.replace(/\s+gesproken$/i, '').trim();
}

/** A part that names languages only: no sentence ("Frans. Nederlands"), no second "ondertiteld". */
function plain(part: string): boolean {
  return part.trim() !== '' && !/[.:;()]|ondertitel/i.test(part);
}
