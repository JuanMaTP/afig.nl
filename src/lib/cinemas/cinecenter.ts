// Cinecenter (www.cinecenter.nl), on the Tricket ticketing platform. It has no robots.txt (3 October 2026: the
// address serves the agenda page); terms in plan §5.7. The homepage carries its whole programme, about a month
// ahead, as the data of its schedule component (an Astro island, `DailyGridSchedule`): each production with its
// director, runtime, language and subtitles, and each screening's start in UTC with its ticket link. One request
// reads the whole cinema.
// - `releaseDate` is the Dutch release, not the film's year, so it isn't used: a repertory film would get this year.
// - The version with English subtitles is a production of its own, "Eng Subs: …". Its subtitles field
//   sometimes says Dutch (3 October 2026, "Eng Subs: The Cycle of Love"); the cinema's own mark in the title wins.
import { parseHTML } from 'linkedom';
import { z } from 'astro/zod';
import {
  type BilledFilm,
  CinemaFormatError,
  cleanBilledTitle,
  languageInEnglish,
  type ProgrammeReader,
} from './cinema';

const ORIGIN = 'https://www.cinecenter.nl';
const ENGLISH_SUBS_MARK = /\beng(?:lish)?\s+subs?\b/i;
// The subtitles field: "Nederlands", "nl-NL", "en-US", "Geen ondertiteling", or nothing.
const SUBTITLE_CODES: Record<string, string> = { 'nl-nl': 'Dutch', 'en-us': 'English', 'en-gb': 'English', 'geen ondertiteling': 'none' };

const screeningSchema = z.object({ startAtUtc: z.iso.datetime(), url: z.string().nullish() });
const productionSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  directedBy: z.string().nullish(),
  durationInMinutes: z.number().int().nonnegative().nullish(),
  language: z.string().nullish(),
  subtitle: z.string().nullish(),
  screenings: z.array(screeningSchema),
});

export const cinecenter: ProgrammeReader = {
  kind: 'programme',
  venueId: 'cinecenter',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/`,

  readProgramme(html) {
    const { document } = parseHTML(html);
    const island = [...document.querySelectorAll('astro-island')].find((i) => /DailyGridSchedule/.test(i.getAttribute('component-url') ?? ''));
    if (!island) throw new CinemaFormatError(`${ORIGIN}/: no schedule`);
    let data: unknown;
    try {
      data = revive(JSON.parse(island.getAttribute('props') ?? ''));
    } catch {
      throw new CinemaFormatError(`${ORIGIN}/: the schedule's data can't be read`);
    }
    const productions = (data as { productions?: unknown })?.productions;
    if (!Array.isArray(productions) || productions.length === 0) throw new CinemaFormatError(`${ORIGIN}/: no films`);

    const films: BilledFilm[] = [];
    const problems: string[] = [];
    for (const raw of productions) {
      const parsed = productionSchema.safeParse(raw);
      if (!parsed.success) {
        problems.push(`${ORIGIN}/: a film the reader can't read (${(raw as { title?: string })?.title ?? 'no title'})`);
        continue;
      }
      const film = parsed.data;
      const title = film.title.replace(/\s+/g, ' ').trim();
      const year = /\((1[89]\d\d|20\d\d)\)/.exec(title)?.[1];
      films.push({
        sourceUrl: `${ORIGIN}/film/${film.slug}/`,
        title,
        clues: { titles: [cleanBilledTitle(title)].filter(Boolean), year: year ? Number(year) : null, directors: film.directedBy?.trim() || null },
        runtime: film.durationInMinutes || null,
        language: film.language?.trim() ? languageInEnglish(film.language) : null,
        subtitles: ENGLISH_SUBS_MARK.test(title) ? 'English' : subtitles(film.subtitle),
        screenings: film.screenings.map((s) => ({
          startsAt: new Date(s.startAtUtc).toISOString(),
          subtitles: null,
          ticketUrl: s.url && /^https:\/\//.test(s.url) ? s.url : null,
        })),
      });
    }
    return { films, problems };
  },
};

function subtitles(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;
  return SUBTITLE_CODES[text.toLowerCase()] ?? languageInEnglish(text);
}

/**
 * Astro serialises an island's props as `[type, value]` pairs: 0 a plain value (objects hold pairs too), 1 an
 * array of pairs. Other types (dates, maps…) aren't used by this schedule and come back as their raw value.
 */
function revive(value: unknown): unknown {
  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
    const [type, inner] = value as [number, unknown];
    if (type === 1 && Array.isArray(inner)) return inner.map(revive);
    if (type === 0 && inner && typeof inner === 'object') {
      return Array.isArray(inner) ? inner.map(revive) : Object.fromEntries(Object.entries(inner).map(([k, v]) => [k, revive(v)]));
    }
    return inner;
  }
  if (value && typeof value === 'object') {
    return Array.isArray(value) ? value.map(revive) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, revive(v)]));
  }
  return value;
}
