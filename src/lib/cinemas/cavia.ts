// Filmhuis Cavia (filmhuiscavia.nl, Concrete CMS). robots.txt disallows only the CMS's own folders; its house
// rules and ticket pages say nothing about reading or reusing the programme (3 October 2026; plan §5.7). The
// homepage links the month's programme (`/programma/oktober-2026`), a page written by hand: after a table of
// contents, each screening is a section that starts with an `<hr id="…">`, then its day and time ("Donderdag 1
// oktober, 20:00"), a strand (`<h3>`), the title (`<h2>`) and a credit line in bold: "Eduardo Coutinho | 1984 |
// Brazil | 119’ | EN subtitles". Credits are read only in that order, and only what reads cleanly; a section
// whose day can't be read is a problem, not a guess. No spoken language is stated, and tickets are sold at
// the door and through Cineville, so there is no ticket link.
import { parseHTML } from 'linkedom';
import { SITE_TIME_ZONE, zonedTimeToUtcIso } from '../time';
import { type BilledFilm, type BilledScreening, CinemaFormatError, cleanBilledTitle, type ProgrammeReader } from './cinema';

const ORIGIN = 'https://filmhuiscavia.nl';
const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const PROGRAMME_PAGE = new RegExp(`^https://filmhuiscavia\\.nl/programma/(${MONTHS.join('|')})-(\\d{4})$`);
const DAY_AND_TIME = new RegExp(
  `\\b(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\\s+(\\d{1,2})\\s+(${MONTHS.join('|')}),?\\s+(\\d{1,2})[:.](\\d{2})\\b`,
  'gi',
);
const SUBTITLES: Record<string, string> = { en: 'English', english: 'English', engels: 'English', nl: 'Dutch', dutch: 'Dutch', nederlands: 'Dutch' };

export const cavia: ProgrammeReader = {
  kind: 'programme',
  venueId: 'cavia',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/`,

  programmePageUrls(html) {
    const { document } = parseHTML(html);
    const urls = [...document.querySelectorAll('a[href]')].map((a) => new URL(a.getAttribute('href') ?? '', ORIGIN).href.replace(/[?#].*$/, ''));
    return [...new Set(urls.filter((url) => PROGRAMME_PAGE.test(url)))];
  },

  readProgramme(html, _now, url) {
    const page = PROGRAMME_PAGE.exec(url);
    if (!page) throw new CinemaFormatError(`${url}: not a month's programme`);
    const year = Number(page[2]);
    const { document } = parseHTML(html);
    const rules = [...document.querySelectorAll('hr')];
    if (rules.length === 0) throw new CinemaFormatError(`${url}: no screenings`);

    const films: BilledFilm[] = [];
    const problems: string[] = [];
    for (const rule of rules) {
      // The section: everything after the rule, up to the next one.
      const section: Element[] = [];
      for (let el = rule.nextElementSibling; el && el.tagName !== 'HR'; el = el.nextElementSibling) section.push(el);
      const heading = section.find((el) => el.tagName === 'H2');
      const title = heading?.textContent?.replace(/\s+/g, ' ').trim();
      if (!heading || !title) continue; // not a screening

      // The day and time come before the title; one section can give more than one.
      const before = section.slice(0, section.indexOf(heading)).map((el) => el.textContent ?? '').join(' ');
      const screenings: BilledScreening[] = [];
      for (const m of before.replace(/\s+/g, ' ').matchAll(DAY_AND_TIME)) {
        const moment = { year, month: MONTHS.indexOf(m[2]!.toLowerCase()) + 1, day: Number(m[1]), hour: Number(m[3]), minute: Number(m[4]), second: 0 };
        screenings.push({ startsAt: zonedTimeToUtcIso(moment, SITE_TIME_ZONE), subtitles: null, ticketUrl: null });
      }
      if (screenings.length === 0) {
        problems.push(`${url}: "${title}" without a day and time that can be read`);
        continue;
      }

      const strand = section.find((el) => el.tagName === 'H3' && section.indexOf(el) < section.indexOf(heading))?.textContent?.trim();
      const credits = readCredits(section.slice(section.indexOf(heading) + 1));
      films.push({
        sourceUrl: `${url}#${rule.id || slug(title)}`,
        title,
        clues: { titles: titles(title, strand), year: credits.year, directors: credits.director },
        runtime: credits.runtime,
        language: null,
        subtitles: credits.subtitles,
        screenings,
      });
    }
    return { films, problems };
  },
};

/** The first bold line with two or more "|": director, year, country, runtime, version. */
function readCredits(elements: Element[]): { director: string | null; year: number | null; runtime: number | null; subtitles: string | null } {
  const line = elements
    .flatMap((el) => [...el.querySelectorAll('strong')])
    .map((strong) => strong.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    .find((text) => text.split('|').length >= 3);
  if (!line) return { director: null, year: null, runtime: null, subtitles: null };
  const parts = line.split('|').map((part) => part.trim());
  const year = /^(1[89]\d\d|20\d\d)$/.exec(parts[1] ?? '')?.[1];
  const runtime = parts.map((part) => /^(\d{1,3})\s*[’'′]$/.exec(part)?.[1]).find(Boolean);
  const subtitles = parts.map((part) => /^(\S+)\s+(?:subtitles|subs|ondertiteld|ondertiteling)$/i.exec(part)?.[1]?.toLowerCase()).find(Boolean);
  return {
    // Only when the year follows it: a programme of shorts has no single director.
    director: year && parts[0] ? parts[0] : null,
    year: year ? Number(year) : null,
    runtime: runtime ? Number(runtime) : null,
    subtitles: subtitles ? (SUBTITLES[subtitles] ?? null) : null,
  };
}

/**
 * "Brazil Unfiltered: Ouvidor" under the strand "Brazil Unfiltered" → "Ouvidor"; "Ménilmontant with live score
 * by Kadavergraver" → "Ménilmontant". A title in brackets is the film's other title, and is tried too:
 * "Cabra Marcado Para Morrer (Man Marked for Death, 20 Years Later)".
 */
function titles(title: string, strand: string | undefined): string[] {
  let main = title;
  if (strand && main.toLowerCase().startsWith(`${strand.toLowerCase()}:`)) main = main.slice(strand.length + 1);
  main = main.replace(/\s+(?:with|\+)\s+live score\b.*$/i, '').replace(/\s+\+\s+.*$/, '');
  const other = /\(([^()]{3,})\)/.exec(main)?.[1]?.trim();
  return [cleanBilledTitle(main), other && !/^\d{4}$/.test(other) ? cleanBilledTitle(other) : ''].filter(Boolean);
}

function slug(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
