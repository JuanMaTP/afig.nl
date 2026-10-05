// Reads one cinema politely (plan §9, Cinema reads): its robots.txt first, then the programme and each film
// page, one request at a time, a pause between requests (longer when robots.txt sets a Crawl-delay), and a
// User-Agent naming the site. Bot protection is never worked around: a refused page is a problem, not a retry.
import { type BilledFilm, CinemaFormatError, type CinemaReader } from './cinema';

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export const USER_AGENT = 'afig-website (+https://afig.nl)';
export const MIN_PAUSE_MS = 2000;
/** More film pages failing than this share fails the whole read: the cinema keeps its last screenings. */
const MAX_FAILED_SHARE = 0.2;

export interface CinemaRead {
  films: BilledFilm[];
  /** Pages that failed, with why. */
  problems: string[];
  /** False when the read can't be trusted to replace the last one. */
  complete: boolean;
}

export interface ReadOptions {
  sleep?: (ms: number) => Promise<void>;
}

export async function readCinema(reader: CinemaReader, fetchFn: Fetch, now: Date, options: ReadOptions = {}): Promise<CinemaRead> {
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const get = async (url: string): Promise<string> => {
    let response: Response;
    try {
      response = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' }, redirect: 'manual' });
    } catch (error) {
      throw new PageError(`fetch failed: ${message(error)}`);
    }
    if (!response.ok) throw new PageError(`HTTP ${response.status}`);
    return response.text();
  };

  let robots: Robots;
  try {
    robots = parseRobots(await get(`${reader.origin}/robots.txt`));
  } catch (error) {
    // No robots.txt (404) means no rules; any other failure stops the read.
    if (!(error instanceof Error && error.message === 'HTTP 404')) return failed(`robots.txt: ${message(error)}`);
    robots = parseRobots('');
  }
  const pause = Math.max(MIN_PAUSE_MS, (robots.crawlDelay ?? 0) * 1000);
  const allowed = (url: string) => robots.allows(new URL(url).pathname);
  if (!allowed(reader.indexUrl)) return failed(`robots.txt disallows ${reader.indexUrl}`);

  let index: string;
  try {
    await sleep(pause);
    index = await get(reader.indexUrl);
  } catch (error) {
    return failed(`${reader.indexUrl}: ${message(error)}`);
  }

  if (reader.kind === 'programme') {
    // The programme is the index itself, or the pages it links (Cavia: one a month). Any of them failing fails
    // the read: the films only it carries would otherwise drop out.
    const programme: { films: BilledFilm[]; problems: string[] } = { films: [], problems: [] };
    let url = reader.indexUrl;
    try {
      const pages = reader.programmePageUrls ? reader.programmePageUrls(index) : [reader.indexUrl];
      if (pages.length === 0) return failed(`${reader.indexUrl}: no programme pages found`);
      for (url of pages) {
        if (!allowed(url)) return failed(`robots.txt disallows ${url}`);
        let html = index;
        if (url !== reader.indexUrl) {
          await sleep(pause);
          html = await get(url);
        }
        const read = reader.readProgramme(html, now, url);
        programme.films.push(...read.films);
        programme.problems.push(...read.problems);
      }
    } catch (error) {
      if (!(error instanceof CinemaFormatError) && !(error instanceof PageError)) throw error;
      return failed(url === reader.indexUrl ? error.message : `${url}: ${error.message}`);
    }
    const films = programme.films.map((film) => ({ ...film, screenings: film.screenings.filter((s) => s.startsAt > now.toISOString()) }));
    const complete = programme.films.length > 0 && programme.problems.length <= (programme.films.length + programme.problems.length) * MAX_FAILED_SHARE;
    return { films, problems: programme.problems, complete };
  }

  let urls: string[];
  try {
    urls = reader.filmPageUrls(index);
  } catch (error) {
    return failed(`${reader.indexUrl}: ${message(error)}`);
  }
  // Any index failing fails the read: the films only it links would otherwise drop out.
  for (const more of reader.moreIndexUrls ?? []) {
    if (!allowed(more)) return failed(`robots.txt disallows ${more}`);
    try {
      await sleep(pause);
      urls.push(...reader.filmPageUrls(await get(more)));
    } catch (error) {
      return failed(`${more}: ${message(error)}`);
    }
  }
  urls = [...new Set(urls)];
  // An empty programme is far more likely a changed page than a closed cinema (the cinema run's §2).
  if (urls.length === 0) return failed(`${reader.indexUrl}: no film pages found`);

  const films: BilledFilm[] = [];
  const problems: string[] = [];
  let failures = 0;
  for (const url of urls) {
    if (!allowed(url)) {
      problems.push(`${url}: disallowed by robots.txt`);
      continue;
    }
    try {
      await sleep(pause);
      const film = reader.readFilmPage(await get(url), url, now);
      films.push({ ...film, screenings: film.screenings.filter((s) => s.startsAt > now.toISOString()) });
    } catch (error) {
      if (!(error instanceof CinemaFormatError) && !(error instanceof PageError)) throw error;
      problems.push(`${url}: ${message(error)}`);
      failures++;
    }
  }
  // A page robots.txt disallows is skipped on purpose, not a failure.
  return { films, problems, complete: failures <= urls.length * MAX_FAILED_SHARE };
}

function failed(problem: string): CinemaRead {
  return { films: [], problems: [problem], complete: false };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface Robots {
  crawlDelay: number | null;
  allows(path: string): boolean;
}

/**
 * The rules for every robot (`User-agent: *`), and for this site's own agent when named. The longest
 * matching rule wins, Allow over Disallow on a tie (RFC 9309); `*` and `$` in paths are supported.
 */
export function parseRobots(text: string): Robots {
  const rules: { allow: boolean; path: string }[] = [];
  let crawlDelay: number | null = null;
  let agents: string[] = [];
  let inRules = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const key = match[1]!.toLowerCase();
    const value = match[2]!.trim();
    if (key === 'user-agent') {
      if (inRules) agents = [];
      inRules = false;
      agents.push(value.toLowerCase());
      continue;
    }
    inRules = true;
    if (!agents.some((a) => a === '*' || a === 'afig-website')) continue;
    if (key === 'disallow' && value !== '') rules.push({ allow: false, path: value });
    if (key === 'allow' && value !== '') rules.push({ allow: true, path: value });
    if (key === 'crawl-delay' && /^\d+(\.\d+)?$/.test(value)) crawlDelay = Math.max(crawlDelay ?? 0, Number(value));
  }
  return {
    crawlDelay,
    allows(path) {
      const matching = rules.filter((rule) => pathPattern(rule.path).test(path));
      if (matching.length === 0) return true;
      const longest = Math.max(...matching.map((r) => r.path.length));
      return matching.filter((r) => r.path.length === longest).some((r) => r.allow);
    },
  };
}

function pathPattern(path: string): RegExp {
  const anchored = path.endsWith('$');
  const body = (anchored ? path.slice(0, -1) : path)
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

/** A page that didn't arrive: an HTTP error, a redirect, or no answer at all. */
class PageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageError';
  }
}
