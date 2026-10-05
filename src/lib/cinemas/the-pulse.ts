// Cinema The Pulse (www.cinemathepulse.com, built with Webflow). Its robots.txt names no user agent, so its rules
// (paging and `/scripts`) bind no robot; its only legal page, the privacy statement, says nothing about reading
// or reusing the programme (3 October 2026; plan §5.7). The homepage links every film page
// (`/films/<id>-<squashed title>`; the sitemap lags behind it). A film page has labelled facts (`REGISSEUR`, `JAAR`,
// `LENGTE`, `TAAL`, `ONDERTITELS`, in English words) and each screening with its day ("Oct 3, 2026"), time
// ("16:15") and room, plus the same moment written out ("10/3/2026 4:15 PM") for the page's own script, which
// the reader checks the time against. Tickets are sold in the cinema's app, so there is no ticket link to keep.
// The version with English subtitles is a page of its own, "Downtown (English Subtitles)".
import { parseHTML } from 'linkedom';
import { SITE_TIME_ZONE, zonedTimeToUtcIso } from '../time';
import { type BilledFilm, type BilledScreening, CinemaFormatError, cleanBilledTitle, type FilmPagesReader } from './cinema';

const ORIGIN = 'https://www.cinemathepulse.com';
const FILM_PAGE = /^https:\/\/www\.cinemathepulse\.com\/films\/[0-9a-f-]+-[a-z0-9]+$/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAY = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/;
const TIME = /^(\d{2}):(\d{2})$/;
const WRITTEN_OUT = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}) ([AP]M)$/;

export const thePulse: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'the-pulse',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/`,

  filmPageUrls(html) {
    const { document } = parseHTML(html);
    const urls = [...document.querySelectorAll('a[href]')].map((a) => new URL(a.getAttribute('href') ?? '', ORIGIN).href.replace(/[?#].*$/, ''));
    return [...new Set(urls.filter((url) => FILM_PAGE.test(url)))];
  },

  readFilmPage(html, url) {
    const { document } = parseHTML(html);
    const title = document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!title) throw new CinemaFormatError(`${url}: no title`);

    // A `<p class="heading-style-h7">JAAR</p>` and the visible `<h3>`s beside it; Webflow hides empty fields.
    const facts = new Map<string, string>();
    for (const label of document.querySelectorAll('p.heading-style-h7')) {
      const field = label.parentElement;
      if (!field || field.classList.contains('w-condition-invisible')) continue;
      const value = [...field.querySelectorAll('h3')]
        .filter((h3) => !h3.classList.contains('w-condition-invisible'))
        .map((h3) => h3.textContent?.replace(/\s+/g, ' ').trim())
        .join(' ')
        .trim();
      const key = label.textContent?.trim().toLowerCase();
      if (key && value && value !== '-' && !facts.has(key)) facts.set(key, value);
    }

    const screenings = new Map<string, BilledScreening>();
    for (const show of document.querySelectorAll('.shows_item')) {
      const day = DAY.exec(show.querySelector('.shows_date_qr')?.textContent?.trim() ?? '');
      const time = TIME.exec(show.querySelector('.shows_time')?.textContent?.trim() ?? '');
      const month = day ? MONTHS.indexOf(day[1]!.toLowerCase()) + 1 : 0;
      if (!day || !time || month === 0) throw new CinemaFormatError(`${url}: a screening without a day and time`);
      const moment = { year: Number(day[3]), month, day: Number(day[2]), hour: Number(time[1]), minute: Number(time[2]) };
      if (!agrees(moment, show.querySelector('.shows_date_sync')?.textContent?.trim() ?? '')) {
        throw new CinemaFormatError(`${url}: a screening whose day and time disagree with the page's own`);
      }
      const startsAt = zonedTimeToUtcIso({ ...moment, second: 0 }, SITE_TIME_ZONE);
      screenings.set(startsAt, { startsAt, subtitles: null, ticketUrl: null });
    }

    const year = /^(1[89]\d\d|20\d\d)$/.exec(facts.get('jaar') ?? '')?.[1];
    const runtime = /^(\d{1,3})\b/.exec(facts.get('lengte') ?? '')?.[1];
    return {
      sourceUrl: url,
      title,
      clues: { titles: [cleanBilledTitle(title)].filter(Boolean), year: year ? Number(year) : null, directors: facts.get('regisseur') ?? null },
      runtime: runtime ? Number(runtime) : null,
      language: facts.get('taal') ?? null,
      subtitles: facts.get('ondertitels')?.replace(/\s+subtitles?$/i, '') || null,
      screenings: [...screenings.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    } satisfies BilledFilm;
  },
};

/** Whether "10/3/2026 4:15 PM" is the same moment as Oct 3, 2026 at 16:15. */
function agrees(moment: { year: number; month: number; day: number; hour: number; minute: number }, writtenOut: string): boolean {
  const w = WRITTEN_OUT.exec(writtenOut);
  if (!w) return false;
  const hour = (Number(w[4]) % 12) + (w[6] === 'PM' ? 12 : 0);
  return Number(w[1]) === moment.month && Number(w[2]) === moment.day && Number(w[3]) === moment.year && hour === moment.hour && Number(w[5]) === moment.minute;
}
