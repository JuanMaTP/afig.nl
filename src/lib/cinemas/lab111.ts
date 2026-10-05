// LAB111 (www.lab111.nl). Checked 3 October 2026: its terms are about ticket sales only, and robots.txt allows
// everything, with no Crawl-delay (plan §5.7). lab111.nl redirects to www. The programme page carries every
// film and screening, so one request a day reads the whole cinema: each film is a `.filmdetails` block with its
// title and year as data attributes, labelled lines (`Regisseur:`, `Jaar:`, `Speelduur:`, `Ondertiteling:`; no
// spoken language) and a table with a row per screening ("di 6 okt 10:30", the room, a ticket link). Rows
// beyond the first few are in the page too, hidden.
import { parseHTML } from 'linkedom';
import {
  type BilledFilm,
  type BilledScreening,
  CinemaFormatError,
  cleanBilledTitle,
  dayAndTime,
  languageInEnglish,
  type ProgrammeReader,
} from './cinema';

const ORIGIN = 'https://www.lab111.nl';
const FILM_PAGE = /^https:\/\/www\.lab111\.nl\/movie\/[a-z0-9-]+\/$/;
// "wo 11 nov 18:00", "di  6 okt 10:30"
const DAY_AND_TIME = /^([a-z]{2}\s+\d{1,2}\s+[a-z]{3})\s+(\d{1,2}:\d{2})$/i;

export const lab111: ProgrammeReader = {
  kind: 'programme',
  venueId: 'lab111',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/programma/`,

  readProgramme(html, now) {
    const { document } = parseHTML(html);
    const blocks = [...document.querySelectorAll('.filmdetails')];
    if (blocks.length === 0) throw new CinemaFormatError(`${ORIGIN}/programma/: no films`);

    const films: BilledFilm[] = [];
    const problems: string[] = [];
    for (const block of blocks) {
      const url = block.querySelector('h2 a[href]')?.getAttribute('href') ?? '';
      const title = (block.getAttribute('data-title') ?? block.querySelector('h2')?.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!FILM_PAGE.test(url) || !title) {
        problems.push(`${ORIGIN}/programma/: a film without a title or page (${title || url || 'nothing'})`);
        continue;
      }

      const labels = new Map<string, string>();
      for (const label of block.querySelectorAll('b')) {
        const name = label.textContent?.replace(/:\s*$/, '').trim().toLowerCase();
        const value = label.parentElement?.textContent?.replace(label.textContent ?? '', '').replace(/\s+/g, ' ').trim();
        if (name && value && !labels.has(name)) labels.set(name, value);
      }

      try {
        const screenings: BilledScreening[] = [];
        for (const row of block.querySelectorAll('tr.day')) {
          // Before ticket sales open, the day and time are plain text, without a link (Clueless, 3 October 2026).
          const cell = row.querySelector('td');
          const link = cell?.querySelector('a[href]');
          const when = DAY_AND_TIME.exec(cell?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
          if (!when) throw new CinemaFormatError(`${url}: a screening without a day and time`);
          const ticket = link?.getAttribute('href') ?? null;
          screenings.push({
            startsAt: dayAndTime(when[1]!, when[2]!, now),
            subtitles: null,
            ticketUrl: ticket && /^https:\/\//.test(ticket) ? ticket : null,
          });
        }
        const year = /^(1[89]\d\d|20\d\d)$/.exec(labels.get('jaar') ?? block.getAttribute('data-year') ?? '')?.[1];
        const runtime = /^(\d{1,3})\s*min/.exec(labels.get('speelduur') ?? '')?.[1];
        const subtitles = labels.get('ondertiteling');
        films.push({
          sourceUrl: url,
          title,
          clues: { titles: [cleanBilledTitle(title)].filter(Boolean), year: year ? Number(year) : null, directors: labels.get('regisseur') ?? null },
          runtime: runtime ? Number(runtime) : null,
          language: null,
          subtitles: subtitles ? languageInEnglish(subtitles) : null,
          screenings,
        });
      } catch (error) {
        if (!(error instanceof CinemaFormatError)) throw error;
        problems.push(error.message);
      }
    }
    return { films, problems };
  },
};
