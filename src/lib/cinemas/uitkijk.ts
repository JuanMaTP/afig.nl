// Filmtheater De Uitkijk (www.uitkijk.nl). Checked 3 October 2026: its terms are for its Friends only, and
// robots.txt allows everything with `Crawl-delay: 5`, which the run honours (plan §5.7). The homepage links every
// film (`/film/<slug>`) and shows only the coming week; a film page has every screening, further ahead too.
// A film page carries labelled lines (`Taal:`, `Ondertiteling:`, `Speeltijd:`, `Regie:`, `Jaar:`) and a ticket
// link per screening, whose `data-date` ("05-10-26-17:00") is the start in Amsterdam time.
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

const ORIGIN = 'https://www.uitkijk.nl';
const FILM_PAGE = /^https:\/\/www\.uitkijk\.nl\/film\/([a-z0-9-]+)$/;
const DATA_DATE = /^(\d{2})-(\d{2})-(\d{2})-(\d{2}):(\d{2})$/;

export const uitkijk: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'de-uitkijk',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/`,

  filmPageUrls(html) {
    const { document } = parseHTML(html);
    const urls = [...document.querySelectorAll('a[href]')]
      .map((a) => new URL(a.getAttribute('href') ?? '', ORIGIN).href.replace(/[?#].*$/, '').replace(/\/$/, ''))
      .filter((href) => FILM_PAGE.test(href));
    return [...new Set(urls)];
  },

  readFilmPage(html, url, _now) {
    const slug = FILM_PAGE.exec(url)?.[1];
    const { document } = parseHTML(html);
    const title = document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!slug || !title) throw new CinemaFormatError(`${url}: no title`);

    const labels = new Map<string, string>();
    for (const label of document.querySelectorAll('li > strong')) {
      const name = label.textContent?.replace(/:\s*$/, '').trim().toLowerCase();
      const value = label.parentElement?.textContent?.replace(label.textContent ?? '', '').replace(/\s+/g, ' ').trim();
      if (name && value && !labels.has(name)) labels.set(name, value);
    }

    const screenings: BilledScreening[] = [];
    for (const link of document.querySelectorAll('a[data-date][data-film]')) {
      if (link.getAttribute('data-film') !== slug) continue;
      const date = DATA_DATE.exec(link.getAttribute('data-date') ?? '');
      if (!date) throw new CinemaFormatError(`${url}: a screening without a date`);
      const [, day, month, year, hour, minute] = date.map(Number) as number[];
      const ticket = link.getAttribute('href') ?? '';
      screenings.push({
        startsAt: zonedTimeToUtcIso({ year: 2000 + year!, month: month!, day: day!, hour: hour!, minute: minute!, second: 0 }, SITE_TIME_ZONE),
        subtitles: null,
        ticketUrl: /^https:\/\//.test(ticket) ? ticket : null,
      });
    }

    const year = /^(1[89]\d\d|20\d\d)$/.exec(labels.get('jaar') ?? '')?.[1] ?? /\((1[89]\d\d|20\d\d)\)/.exec(title)?.[1];
    const runtime = /^(\d{1,3})\s*min/.exec(labels.get('speeltijd') ?? '')?.[1];
    const language = labels.get('taal');
    const subtitles = labels.get('ondertiteling');
    return {
      sourceUrl: url,
      title,
      clues: { titles: [cleanBilledTitle(title)].filter(Boolean), year: year ? Number(year) : null, directors: labels.get('regie') ?? null },
      runtime: runtime ? Number(runtime) : null,
      language: language ? languageInEnglish(language) : null,
      subtitles: subtitles ? languageInEnglish(subtitles) : null,
      screenings: screenings.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    } satisfies BilledFilm;
  },
};
