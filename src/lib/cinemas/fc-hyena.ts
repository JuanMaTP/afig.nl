// FC Hyena (fchyena.nl, built with Framer). robots.txt allows everything, with no Crawl-delay (3 October 2026);
// the site has no legal pages (plan §5.7). Its film pages (`/films/<id>`, the id of the production on its ticket
// site) are linked only from the sitemap, which lists every one. A film page has labelled facts (`Director`,
// `Duration`, `Country`, `Language`, `Year`) as text, and the screenings of one week as `<time>`s.
// - The page is rendered when the cinema publishes the site, so it shows the week from that day (the times
//   of 1 to 7 October, read on 3 October 2026); its day labels ("Today", "Saturday") are of that day too, and
//   aren't read.
// - A `<time datetime="2026-10-04T15:45:00.000Z">15:45</time>` is the Amsterdam time with a "Z": Framer shows
//   CMS times in UTC (its formatter sets `timeZone: 'UTC'`), so every visitor sees 15:45, and the times run from
//   11:00 to 21:30. The reader takes the time as shown, and refuses a page where it differs from the datetime.
// - The language line carries the subtitles too, in Dutch or English: "Engels gesproken, Nederlands
//   ondertiteld", "Hebrew, with English subs". The version with English subtitles is a production of its own,
//   "NAZA - ENG SUBS". The ticket site disallows every robot: the reader only links to it.
import { parseHTML } from 'linkedom';
import { SITE_TIME_ZONE, zonedTimeToUtcIso } from '../time';
import {
  type BilledFilm,
  type BilledScreening,
  CinemaFormatError,
  cleanBilledTitle,
  type FilmPagesReader,
  languageInEnglish,
} from './cinema';

const ORIGIN = 'https://fchyena.nl';
const FILM_PAGE = /^https:\/\/fchyena\.nl\/films\/(\d+)$/;
const SHOWN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):00(?:\.000)?Z$/;
/** " - ENG SUBS", " - NL subs": the cinema's mark for the version. */
const VERSION_MARK = /\s+-\s+(eng|nl)\s+subs?\s*$/i;
const FACTS = ['director', 'duration', 'country', 'language', 'year'];
const SHORT_LANGUAGES: Record<string, string> = { nl: 'Dutch', en: 'English', eng: 'English' };

export const fcHyena: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'fc-hyena',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/sitemap.xml`,

  filmPageUrls(xml) {
    const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]!).filter((url) => FILM_PAGE.test(url));
    return [...new Set(urls)];
  },

  readFilmPage(html, url, _now) {
    const { document } = parseHTML(html);
    const title = document.querySelector('h1, h2')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!title) throw new CinemaFormatError(`${url}: no title`);

    // Each label and value is a text block of its own: "Director", then "Yuval Abraham, Rachel Szor".
    const texts = [...document.querySelectorAll('[data-framer-component-type="RichTextContainer"]')].map(
      (block) => block.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
    const facts = new Map<string, string>();
    for (const [i, text] of texts.entries()) {
      const label = text.toLowerCase();
      const value = texts[i + 1];
      // "?" is how the page says it doesn't know yet.
      if (FACTS.includes(label) && !facts.has(label) && value && value !== '?' && !FACTS.includes(value.toLowerCase())) facts.set(label, value);
    }

    // The ticket link is the production's, the same for every screening of the page.
    const id = FILM_PAGE.exec(url)?.[1];
    const ticket = [...document.querySelectorAll('a[href^="https://tickets.fchyena.nl/"]')]
      .map((a) => a.getAttribute('href') ?? '')
      .find((href) => new URL(href).searchParams.get('production_id') === id) ?? null;

    const screenings = new Map<string, BilledScreening>();
    for (const time of document.querySelectorAll('[name="times-container"] time[datetime]')) {
      const value = time.getAttribute('datetime') ?? '';
      const shown = SHOWN.exec(value);
      if (!shown || `${shown[4]}:${shown[5]}` !== time.textContent?.trim()) {
        throw new CinemaFormatError(`${url}: a screening whose time isn't shown as expected: "${value}" "${time.textContent}"`);
      }
      const [year, month, day, hour, minute] = shown.slice(1).map(Number) as [number, number, number, number, number];
      const startsAt = zonedTimeToUtcIso({ year, month, day, hour, minute, second: 0 }, SITE_TIME_ZONE);
      screenings.set(startsAt, { startsAt, subtitles: null, ticketUrl: ticket });
    }

    const mark = VERSION_MARK.exec(title)?.[1]?.toLowerCase();
    const version = readLanguage(facts.get('language') ?? '');
    const year = /^(1[89]\d\d|20\d\d)$/.exec(facts.get('year') ?? '')?.[1];
    const runtime = /^(\d{1,3})\b/.exec(facts.get('duration') ?? '')?.[1];
    return {
      sourceUrl: url,
      title,
      clues: { titles: [cleanTitle(title)].filter(Boolean), year: year ? Number(year) : null, directors: facts.get('director') ?? null },
      runtime: runtime ? Number(runtime) : null,
      language: version.language,
      // The title's mark wins, as at Cinecenter.
      subtitles: mark === 'eng' ? 'English' : mark === 'nl' ? 'Dutch' : version.subtitles,
      screenings: [...screenings.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    } satisfies BilledFilm;
  },
};

/** "NAZA - ENG SUBS" → "NAZA"; "Scream! Digger" (its Hyena Scream strand) → "Digger"; "The Forgotten Island x KALBO" → "The Forgotten Island". */
function cleanTitle(title: string): string {
  return cleanBilledTitle(
    title
      .replace(VERSION_MARK, '')
      .replace(/^scream!\s+/i, '')
      .replace(/\s+x\s+.+$/, ''),
  );
}

/**
 * "Engels gesproken, Nederlands ondertiteld", "Roemeens, Noors gesproken, Nederlands ondertiteld", "Engels
 * gesproken, geen ondertiteling", "Hebrew, with English subs", "NL". A phrasing it doesn't know stays as
 * written, as the language.
 */
export function readLanguage(line: string): { language: string | null; subtitles: string | null } {
  const text = line.replace(/\s+/g, ' ').trim();
  if (!text) return { language: null, subtitles: null };
  const none = /^(.+?)(?:\s+gesproken)?,\s*geen ondertiteling$/i.exec(text);
  if (none) return { language: language(none[1]!), subtitles: 'none' };
  const dutch = /^(.+?)(?:\s+gesproken)?,\s*([^,]+?)\s+ondertiteld$/i.exec(text);
  if (dutch) return { language: language(dutch[1]!), subtitles: language(dutch[2]!) };
  const english = /^(.+?),\s*with\s+([^,]+?)\s+sub(?:s|titles)$/i.exec(text);
  if (english) return { language: language(english[1]!), subtitles: language(english[2]!) };
  const spoken = /^(.+?)\s+gesproken$/i.exec(text);
  if (spoken) return { language: language(spoken[1]!), subtitles: null };
  return { language: language(text), subtitles: null };
}

function language(words: string): string {
  return SHORT_LANGUAGES[words.trim().toLowerCase()] ?? languageInEnglish(words);
}
