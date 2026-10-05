// Rialto De Pijp (depijp.rialtofilm.nl; rialtofilm.nl is only a location selector). robots.txt allows the
// programme to every robot not named as a site ripper (3 October 2026); terms in plan §5.7. `/en/films` links
// every film page (`/en/films/<slug>`). A film page states `Directed by`, `Language` (in Dutch words),
// `Duration` and `Origin` (countries, then the year), and lists its screenings by day ("Monday 26 October"):
// time, room, labels such as "Eng subs", and a ticket link. The labels are the screening's own version.
// Its JSON-LD isn't read: it also lists a film's release day at midnight as if it were a screening.
// The ticket links are written with http://; the ticket site answers https:// (checked 3 October 2026). Its
// robots.txt disallows every robot, so the reader only links to it, never reads it.
import { parseHTML } from 'linkedom';
import {
  type BilledFilm,
  type BilledScreening,
  CinemaFormatError,
  cleanBilledTitle,
  dayAndTime,
  type FilmPagesReader,
  languageInEnglish,
} from './cinema';

const ORIGIN = 'https://depijp.rialtofilm.nl';
const FILM_PAGE = /^https:\/\/depijp\.rialtofilm\.nl\/en\/films\/[a-z0-9-]+$/;
const TICKETS = /^https?:\/\/tickets-depijp\.rialtofilm\.nl\//;

export const rialto: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'rialto-de-pijp',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/en/films`,

  filmPageUrls(html) {
    const { document } = parseHTML(html);
    const urls = [...document.querySelectorAll('a[href]')].map((a) => new URL(a.getAttribute('href') ?? '', ORIGIN).href.replace(/[?#].*$/, ''));
    return [...new Set(urls.filter((url) => FILM_PAGE.test(url)))];
  },

  readFilmPage(html, url, now) {
    const { document } = parseHTML(html);
    const title = document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!title) throw new CinemaFormatError(`${url}: no title`);

    // The film's facts: `.summary-cell` with a `.cell-label` ("Directed by") and a `.cell-value` ("Lukas Dhont").
    const facts = new Map<string, string>();
    for (const cell of document.querySelectorAll('.summary-cell')) {
      const label = cell.querySelector('.cell-label')?.textContent?.trim().toLowerCase();
      const value = cell.querySelector('.cell-value')?.textContent?.replace(/\s+/g, ' ').trim();
      if (label && value && !facts.has(label)) facts.set(label, value);
    }

    const screenings = new Map<string, BilledScreening>();
    for (const group of document.querySelectorAll('.date-group')) {
      const day = group.querySelector('.date-group-title')?.textContent?.trim() ?? '';
      for (const item of group.querySelectorAll('.program-item')) {
        const time = item.querySelector('.program-time')?.textContent?.trim() ?? '';
        const startsAt = dayAndTime(day, time, now);
        const labels = [...item.querySelectorAll('.program-labels .label')].map((l) => l.textContent?.trim().toLowerCase() ?? '');
        const ticket = item.querySelector('.program-actions a[href]')?.getAttribute('href') ?? '';
        screenings.set(startsAt, {
          startsAt,
          subtitles: labels.some((l) => /^eng(?:lish)?\s+sub/.test(l)) ? 'English' : labels.some((l) => /^(?:nl|ned)\w*\s+sub|ondertiteld/.test(l)) ? 'Dutch' : null,
          ticketUrl: TICKETS.test(ticket) ? ticket.replace(/^http:/, 'https:') : null,
        });
      }
    }

    const year = /\b(1[89]\d\d|20\d\d)\s*$/.exec(facts.get('origin') ?? '')?.[1];
    const runtime = /^(\d{1,3})\b/.exec(facts.get('duration') ?? '')?.[1];
    const language = facts.get('language');
    const subtitles = facts.get('subtitles');
    return {
      sourceUrl: url,
      title,
      clues: { titles: [cleanBilledTitle(title)].filter(Boolean), year: year ? Number(year) : null, directors: facts.get('directed by') ?? null },
      runtime: runtime ? Number(runtime) : null,
      language: language ? languageInEnglish(language) : null,
      subtitles: subtitles ? languageInEnglish(subtitles) : null,
      screenings: [...screenings.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    } satisfies BilledFilm;
  },
};
