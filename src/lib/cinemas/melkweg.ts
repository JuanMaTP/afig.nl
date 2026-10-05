// Melkweg's cinema (www.melkweg.nl, Next.js). robots.txt allows everything, with no Crawl-delay; its house rules
// and privacy statement say nothing about reading or reusing the programme, and its visitor terms (the VNPF's,
// 2013) are a scanned PDF about tickets and admission (3 October 2026; plan §5.7). `/nl/agenda/` carries every
// event, concerts and club nights included, in its page data (`__NEXT_DATA__`); those whose profile is "Film"
// are the cinema's. Each is one screening with a page of its own (`/nl/agenda/<slug>-08-10-2026/`), whose data
// gives the film's director, year, runtime, spoken language and subtitles (as codes: "EN", "JP"; "-" for none
// stated), the start in UTC and a Ticketmaster link.
// - The start is the event's, as the cinema lists it: usually an intro, a quarter of an hour before the film
//   ("20:00 Intro / 20:15 Naked (1993)"), once the doors. Its schedule is free text, so it isn't read.
// - Some ticket links are a Ticketmaster search ("?q=kaboom"), not the screening's: only `/event/` links are kept.
//   Ticketmaster is only linked to, never read.
import { z } from 'astro/zod';
import { type BilledFilm, CinemaFormatError, cleanBilledTitle, type FilmPagesReader, languageInEnglish } from './cinema';

const ORIGIN = 'https://www.melkweg.nl';
const FILM_PAGE = /^https:\/\/www\.melkweg\.nl\/nl\/agenda\/[a-z0-9-]+\/$/;
const TICKETS = /^https:\/\/www\.ticketmaster\.nl\/event\//;
/** " + Q&A: El Hefe", " + Intro": what the evening adds to the film. */
const EXTRAS = /\s+\+\s+(?:q\s*&\s*a|intro|talk|nagesprek|live)\b.*$/i;
const LANGUAGE_CODES: Record<string, string> = {
  DE: 'German',
  EN: 'English',
  ES: 'Spanish',
  FR: 'French',
  IT: 'Italian',
  JA: 'Japanese',
  JP: 'Japanese',
  KO: 'Korean',
  NL: 'Dutch',
  PT: 'Portuguese',
  ZH: 'Chinese',
};

const agendaSchema = z.object({
  props: z.object({
    pageProps: z.object({
      pageData: z.object({
        attributes: z.object({
          content: z.array(
            z.object({
              layout: z.string(),
              attributes: z
                .object({
                  initialEvents: z
                    .array(z.object({ attributes: z.object({ url: z.string(), profile: z.string().nullish(), isCancelled: z.boolean().nullish() }) }))
                    .optional(),
                })
                .optional(),
            }),
          ),
        }),
      }),
    }),
  }),
});

const eventSchema = z.object({
  props: z.object({
    pageProps: z.object({
      pageData: z.object({
        attributes: z.object({
          metadata: z.object({
            name: z.string().min(1),
            starttime: z.iso.datetime(),
            ticketLink: z.string().nullish(),
            movieDirector: z.string().nullish(),
            movieYear: z.string().nullish(),
            movieDuration: z.string().nullish(),
            movieSpokenLanguage: z.string().nullish(),
            movieLanguageSubtitles: z.string().nullish(),
          }),
          content: z.array(
            z.object({
              layout: z.string(),
              attributes: z.object({ isCancelled: z.boolean().nullish(), isMovedToNewDate: z.boolean().nullish() }).optional(),
            }),
          ),
        }),
      }),
    }),
  }),
});

export const melkweg: FilmPagesReader = {
  kind: 'film-pages',
  venueId: 'melkweg',
  origin: ORIGIN,
  indexUrl: `${ORIGIN}/nl/agenda/`,

  filmPageUrls(html) {
    const parsed = agendaSchema.safeParse(pageData(html, `${ORIGIN}/nl/agenda/`));
    if (!parsed.success) throw new CinemaFormatError(`${ORIGIN}/nl/agenda/: the agenda's data isn't what it was`);
    const events = parsed.data.props.pageProps.pageData.attributes.content.flatMap((block) => block.attributes?.initialEvents ?? []);
    if (events.length === 0) throw new CinemaFormatError(`${ORIGIN}/nl/agenda/: no events`);
    const urls = events
      .filter((event) => event.attributes.profile === 'Film' && !event.attributes.isCancelled)
      .map((event) => new URL(event.attributes.url.replace(/\/?$/, '/'), ORIGIN).href)
      .filter((url) => FILM_PAGE.test(url));
    return [...new Set(urls)];
  },

  readFilmPage(html, url) {
    const parsed = eventSchema.safeParse(pageData(html, url));
    if (!parsed.success) throw new CinemaFormatError(`${url}: the event's data isn't what it was`);
    const { metadata, content } = parsed.data.props.pageProps.pageData.attributes;
    const header = content.find((block) => block.layout === 'event_header')?.attributes;
    const title = metadata.name.replace(/\s+/g, ' ').trim();

    const year = /\((1[89]\d\d|20\d\d)\)/.exec(title)?.[1] ?? /^(1[89]\d\d|20\d\d)$/.exec(metadata.movieYear?.trim() ?? '')?.[1];
    const runtime = /^(\d{1,3})\s*min/.exec(metadata.movieDuration?.trim() ?? '')?.[1];
    const ticket = metadata.ticketLink?.trim() ?? '';
    // A cancelled or moved event keeps its page; the new date has a page of its own.
    const takesPlace = !header?.isCancelled && !header?.isMovedToNewDate;
    return {
      sourceUrl: url,
      title,
      clues: { titles: [cleanBilledTitle(title.replace(EXTRAS, ''))].filter(Boolean), year: year ? Number(year) : null, directors: metadata.movieDirector?.trim() || null },
      runtime: runtime ? Number(runtime) : null,
      language: languages(metadata.movieSpokenLanguage),
      subtitles: languages(metadata.movieLanguageSubtitles),
      screenings: takesPlace
        ? [{ startsAt: new Date(metadata.starttime.replace(/(\.\d{3})\d+Z$/, '$1Z')).toISOString(), subtitles: null, ticketUrl: TICKETS.test(ticket) ? ticket : null }]
        : [],
    } satisfies BilledFilm;
  },
};

function pageData(html: string, url: string): unknown {
  const script = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!script) throw new CinemaFormatError(`${url}: no page data`);
  try {
    return JSON.parse(script);
  } catch {
    throw new CinemaFormatError(`${url}: the page data can't be read`);
  }
}

/** "EN" → "English", "JP, EN" → "Japanese, English"; "-" or nothing is not stated. */
function languages(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text || text === '-') return null;
  return text
    .split(/\s*[,/&]\s*/)
    .map((code) => LANGUAGE_CODES[code.toUpperCase()] ?? languageInEnglish(code))
    .join(', ');
}
