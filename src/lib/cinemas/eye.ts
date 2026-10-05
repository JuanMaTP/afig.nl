// Eye Filmmuseum (www.eyefilm.nl). Checked 3 October 2026: its terms are for visitors to the building, and
// robots.txt allows everything, with no Crawl-delay (plan §5.7). `/en/whats-on/all-films` links every film
// (`/en/whats-on/<slug>/<id>`). A film page is about 1 MB; the reader takes two things from it:
// - the `Movie` JSON-LD: title, directors, year, runtime, spoken languages, subtitle languages;
// - the film's screenings from the page's own data (Next.js, `self.__next_f.push`): start in Amsterdam time,
//   ticket link, and the screening's subtitles as an id. A page can carry another film's screening too
//   (a double bill), so only those whose address holds this film's id count.
// The page's JSON-LD screenings are not used: they carry no subtitles and no ticket link.
import {
  type BilledFilm,
  type BilledScreening,
  CinemaFormatError,
  cleanBilledTitle,
  type FilmPagesReader,
} from './cinema';
import { SITE_TIME_ZONE, zonedTimeToUtcIso } from '../time';

const ORIGIN = 'https://www.eyefilm.nl';
const FILM_PAGE = /^https:\/\/www\.eyefilm\.nl\/en\/whats-on\/[a-z0-9-]+\/(\d+)$/;

/**
 * Eye's ids for the subtitle languages it uses most. Worked out on 3 October 2026 from film pages with one
 * language, by elimination, never by order: Akira (only Japanese spoken) and Les parapluies de Cherbourg (only
 * French) fix those two; Coward (French and Dutch) then fixes Dutch; Akira's subtitles (Dutch, English) then
 * fix English. A screening shows its subtitles only when the film's JSON-LD names that language too.
 */
const SUBTITLE_IDS: Record<string, string> = {
  '41ad8fc8-2c17-46fd-9094-fb3d4a2884fa': 'Dutch',
  '42c27a5b-2d4e-4195-b547-cb6fbe9fcd49': 'English',
};

const LD_JSON = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
const PAGE_DATA = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;

export const eye: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'eye',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/en/whats-on/all-films`,

  filmPageUrls(html) {
    const urls = [...html.matchAll(/href="(https:\/\/www\.eyefilm\.nl\/en\/whats-on\/[a-z0-9-]+\/\d+)"/g)].map((m) => m[1]!);
    return [...new Set(urls)].filter((url) => FILM_PAGE.test(url));
  },

  readFilmPage(html, url, _now) {
    const filmId = FILM_PAGE.exec(url)?.[1];
    // A double bill ("Not Guilty + New Rose Hotel") has no Movie JSON-LD: its screenings are kept under the
    // page's title, and it isn't matched to a film, since it is two.
    const movie = movieJsonLd(html) ?? {};
    const pageTitle = /<meta property="og:title" content="([^"]*)"/.exec(html)?.[1]?.replace(/\s*\|\s*Eye Filmmuseum\s*$/, '');
    const title = (typeof movie.name === 'string' && movie.name.trim()) || decodeEntities(pageTitle ?? '').trim();
    if (!filmId || !title) throw new CinemaFormatError(`${url}: no title`);
    const single = movie['@type'] === 'Movie';
    const subtitleLanguages = strings(movie.subtitleLanguage);
    const spoken = strings(movie.inLanguage);

    const data = [...html.matchAll(PAGE_DATA)].map((m) => JSON.parse(`"${m[1]}"`) as string).join('');
    const screenings = new Map<string, BilledScreening>();
    for (const show of data.matchAll(/\{"id":"(\d+)","url":"[^"]*","uri":"whats-on\/[a-z0-9-]+\/(\d+)\/\d+"/g)) {
      if (show[2] !== filmId || screenings.has(show[1]!)) continue;
      // The screening's own fields: up to its last one, or the next screening, whichever comes first.
      const end = [data.indexOf('"themesPages"', show.index), data.indexOf('{"id":"', show.index + 1)].filter((i) => i > 0);
      const fields = data.slice(show.index, end.length > 0 ? Math.min(...end) : show.index + 3000);
      const start = /"startDateTime":"(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})"/.exec(fields);
      if (!start) throw new CinemaFormatError(`${url}: a screening without a start`);
      const [, year, month, day, hour, minute] = start.map(Number) as number[];
      const ticket = /"ticketUrl":"(https:\/\/[^"]+)"/.exec(fields)?.[1] ?? null;
      const subtitle = SUBTITLE_IDS[/"singleSubtitles":"([0-9a-f-]{36})"/.exec(fields)?.[1] ?? ''];
      screenings.set(show[1]!, {
        startsAt: zonedTimeToUtcIso({ year: year!, month: month!, day: day!, hour: hour!, minute: minute!, second: 0 }, SITE_TIME_ZONE),
        subtitles: subtitle && subtitleLanguages.includes(subtitle) ? subtitle : null,
        ticketUrl: ticket,
      });
    }

    const year = /^(1[89]\d\d|20\d\d)/.exec(String(movie.datePublished ?? ''))?.[1];
    const runtime = /^PT(\d{1,3})M$/.exec(String(movie.duration ?? ''))?.[1];
    return {
      sourceUrl: url,
      title,
      clues: {
        titles: single ? [cleanBilledTitle(title)].filter(Boolean) : [],
        year: year ? Number(year) : null,
        directors: directorNames(movie.director) || null,
      },
      runtime: runtime ? Number(runtime) : null,
      language: spoken.length > 0 ? spoken.join(', ') : null,
      // One language for the whole film; with two ("NLD or ENG"), each screening says which.
      subtitles: subtitleLanguages.length === 1 ? subtitleLanguages[0]! : null,
      screenings: [...screenings.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    } satisfies BilledFilm;
  },
};

type JsonLd = Record<string, unknown>;

function movieJsonLd(html: string): JsonLd | null {
  for (const match of html.matchAll(LD_JSON)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]!);
    } catch {
      continue;
    }
    const items = (Array.isArray(parsed) ? parsed : [parsed]) as JsonLd[];
    const movie = items.find((item) => item?.['@type'] === 'Movie');
    if (movie) return movie;
  }
  return null;
}

/** The few entities a page title carries: "Jules &amp; Jim" → "Jules & Jim". */
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function strings(value: unknown): string[] {
  return (Array.isArray(value) ? value : value ? [value] : []).filter((v): v is string => typeof v === 'string' && v.trim() !== '');
}

function directorNames(value: unknown): string {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map((d) => (typeof d === 'string' ? d : typeof (d as JsonLd)?.name === 'string' ? ((d as JsonLd).name as string) : ''))
    .filter(Boolean)
    .join(', ');
}
