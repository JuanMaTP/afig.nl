// Cinema De Vlugt (www.cinemadevlugt.nl, WordPress). robots.txt allows everything, with no Crawl-delay (3 October
// 2026); terms in plan §5.7. The homepage links the film pages (`/film/<slug>/`) playing now; films scheduled
// later are only on `/verwacht/`, and strands on `/specials/` and `/kids/`, so all four are read. A film page has
// labelled facts (`Regisseur:`, `Speelduur:`, `Gesproken taal:`, `Ondertiteling:`; no year) and, under
// "Speeltijden & Tickets", each screening with its full date ("Zat 03-10-2026"), time, room and ticket link,
// twice (for mobile and desktop). The year is in the title ("Bint El-Haras (1967)") or the slug
// (`palestine-36-2025`), when at all. Its ticket site disallows every robot: the reader only links to it.
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

const ORIGIN = 'https://www.cinemadevlugt.nl';
const FILM_PAGE = /^https:\/\/www\.cinemadevlugt\.nl\/film\/([a-z0-9-]+)\/$/;
const TICKETS = /^https:\/\/tickets\.cinemadevlugt\.nl\//;
const DATE = /(\d{2})-(\d{2})-(\d{4})/;
const TIME = /(\d{1,2}):(\d{2})/;

export const vlugt: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'cinema-de-vlugt',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/`,
  moreIndexUrls: [`${ORIGIN}/verwacht/`, `${ORIGIN}/specials/`, `${ORIGIN}/kids/`],

  filmPageUrls(html) {
    const { document } = parseHTML(html);
    const urls = [...document.querySelectorAll('a[href]')].map((a) => (a.getAttribute('href') ?? '').replace(/[?#].*$/, ''));
    return [...new Set(urls.filter((href) => FILM_PAGE.test(href)))];
  },

  readFilmPage(html, url, now) {
    const { document } = parseHTML(html);
    const title = (document.querySelector('article h1') ?? document.querySelector('h1'))?.textContent?.replace(/\s+/g, ' ').trim();
    if (!title) throw new CinemaFormatError(`${url}: no title`);

    // `.info-wrap`: a `<strong>Regisseur:</strong>` and a `<p class="info">` with the value.
    const facts = new Map<string, string>();
    for (const wrap of document.querySelectorAll('.info-wrap')) {
      const label = wrap.querySelector('strong')?.textContent?.replace(/:\s*$/, '').trim().toLowerCase();
      const value = wrap.querySelector('.info')?.textContent?.replace(/\s+/g, ' ').trim();
      if (label && value && !facts.has(label)) facts.set(label, value);
    }

    const screenings = new Map<string, BilledScreening>();
    for (const item of document.querySelectorAll('#tickets li')) {
      const date = DATE.exec(item.querySelector('.date')?.textContent ?? '');
      const time = TIME.exec(item.querySelector('.time')?.textContent ?? '');
      if (!date || !time) throw new CinemaFormatError(`${url}: a screening without a date and time`);
      const startsAt = zonedTimeToUtcIso(
        { year: Number(date[3]), month: Number(date[2]), day: Number(date[1]), hour: Number(time[1]), minute: Number(time[2]), second: 0 },
        SITE_TIME_ZONE,
      );
      const ticket = item.querySelector('a[href]')?.getAttribute('href') ?? '';
      screenings.set(startsAt, { startsAt, subtitles: null, ticketUrl: TICKETS.test(ticket) ? ticket : null });
    }

    const runtime = /^(\d{1,3})\s*min/.exec(facts.get('speelduur') ?? '')?.[1];
    const language = facts.get('gesproken taal');
    const subtitles = facts.get('ondertiteling');
    return {
      sourceUrl: url,
      title,
      clues: { titles: [cleanBilledTitle(title)].filter(Boolean), year: yearOf(title, url, now), directors: facts.get('regisseur') ?? null },
      runtime: runtime ? Number(runtime) : null,
      language: language ? languageInEnglish(language) : null,
      subtitles: subtitles ? languageInEnglish(subtitles) : null,
      screenings: [...screenings.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    } satisfies BilledFilm;
  },
};

/**
 * "Bint El-Haras (1967)", or the slug's last part when the title doesn't carry that number itself
 * (`palestine-36-2025`, but not `blade-runner-2049`) and it isn't a year still to come.
 */
function yearOf(title: string, url: string, now: Date): number | null {
  const stated = /\((1[89]\d\d|20\d\d)\)/.exec(title)?.[1];
  if (stated) return Number(stated);
  const slug = FILM_PAGE.exec(url)?.[1] ?? '';
  const last = /-(1[89]\d\d|20\d\d)$/.exec(slug)?.[1];
  if (!last || title.includes(last) || Number(last) > now.getUTCFullYear() + 1) return null;
  return Number(last);
}
