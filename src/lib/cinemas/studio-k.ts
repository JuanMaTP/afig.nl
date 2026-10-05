// Studio/K (studio-k.nu). Checked 3 October 2026: its terms say nothing about reading or reusing the
// programme, and robots.txt allows everything, with no Crawl-delay (plan §5.7). The homepage links every
// film page (`/film/<slug>/`). A film page is server-rendered: labelled lines (`Regie:`, `Jaar:`, `Taal:`,
// `Ondertiteling:`, `Speelduur:`) and, under "TICKETS", each day ("za 03 okt") with its times, sometimes
// the subtitles of that screening, and a ticket link. The version with English subtitles is a separate
// page, "NAZA (ENG SUBS)". Its JSON-LD is unreliable (another cinema's location, a 10-minute end), so it
// isn't read.
import { parseHTML } from 'linkedom';
import { type BilledFilm, type BilledScreening, CinemaFormatError, cleanBilledTitle, dayAndTime, type FilmPagesReader, languageInEnglish } from './cinema';

const ORIGIN = 'https://studio-k.nu';
const FILM_PAGE = /^https:\/\/studio-k\.nu\/film\/[a-z0-9-]+\/$/;
/** "(ENG SUBS)", "(Eng subs)": the cinema's own mark for English subtitles. */
const ENGLISH_SUBS_MARK = /\(\s*eng(?:lish)?\s+subs?\s*\)/i;

export const studioK: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'studio-k',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/`,

  filmPageUrls(html) {
    const { document } = parseHTML(html);
    const urls = [...document.querySelectorAll('a[href]')]
      .map((a) => (a.getAttribute('href') ?? '').replace(/#.*$/, ''))
      .filter((href) => FILM_PAGE.test(href));
    return [...new Set(urls)];
  },

  readFilmPage(html, url, now) {
    const { document } = parseHTML(html);
    const title = document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim();
    if (!title) throw new CinemaFormatError(`${url}: no title`);

    const labels = new Map<string, string>();
    for (const p of document.querySelectorAll('.meta p')) {
      const label = p.querySelector('strong')?.textContent?.replace(/:\s*$/, '').trim().toLowerCase();
      const value = p.textContent?.replace(/^[^:]*:/, '').replace(/\s+/g, ' ').trim();
      if (label && value) labels.set(label, value);
    }

    const screenings: BilledScreening[] = [];
    for (const day of document.querySelectorAll('#shows > li')) {
      const dayLabel = day.querySelector('.sday')?.textContent?.trim();
      if (!dayLabel) continue; // the "TICKETS" heading
      for (const show of day.querySelectorAll('li')) {
        const time = show.querySelector('.stime')?.textContent?.trim();
        if (!time) throw new CinemaFormatError(`${url}: a screening on "${dayLabel}" without a time`);
        const ticket = show.querySelector('a.tickets[href]')?.getAttribute('href') ?? null;
        // "Nederlands <br/>subs", and on some pages "Engels<br />subs", which reads "Engelssubs".
        const subtitles = show.querySelector('.subtitles')?.textContent?.replace(/\s*subs?\s*$/i, '').replace(/\s+/g, ' ').trim();
        screenings.push({
          startsAt: dayAndTime(dayLabel, time, now),
          subtitles: subtitles ? languageInEnglish(subtitles) : null,
          ticketUrl: ticket && /^https:\/\//.test(ticket) ? ticket : null,
        });
      }
    }

    const year = /^(1[89]\d\d|20\d\d)$/.exec(labels.get('jaar') ?? '')?.[1] ?? /\((1[89]\d\d|20\d\d)\)/.exec(title)?.[1] ?? null;
    const runtime = /^(\d{1,3})\s*min/.exec(labels.get('speelduur') ?? '')?.[1];
    const language = labels.get('taal');
    const subtitles = labels.get('ondertiteling');
    return {
      sourceUrl: url,
      title,
      clues: { titles: [cleanBilledTitle(title)].filter(Boolean), year: year ? Number(year) : null, directors: labels.get('regie') ?? null },
      runtime: runtime ? Number(runtime) : null,
      language: language ? languageInEnglish(language) : null,
      subtitles: subtitles ? languageInEnglish(subtitles) : ENGLISH_SUBS_MARK.test(title) ? 'English' : null,
      screenings,
    } satisfies BilledFilm;
  },
};
