// Reads every upcoming event: the events page first, the iCal feed when the page fails or lists nothing
// (plan §9, ingest step 1). Never the RSS feed or Meetup's internal APIs: robots.txt disallows both.
import type { ParsedEvents } from './event';
import { EVENTS_PAGE_URL, parseEventsPage } from './events-page';
import { ICAL_FEED_URL, parseIcalFeed } from './ical-feed';

export interface UpcomingEvents extends ParsedEvents {
  source: 'events-page' | 'ical-feed';
}

/** Neither source could be read. A run that ends here must not mark any event unlisted. */
export class MeetupReadError extends Error {
  override name = 'MeetupReadError';
}

/** Passed in, so tests can replace it (docs/engineering.md, Tests). */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const USER_AGENT = 'afig-website/0.1 (+https://afig.nl)';
const TIMEOUT_MS = 15_000;

export async function readUpcomingEvents(fetchFn: Fetch): Promise<UpcomingEvents> {
  let pageFailure: string;
  try {
    const page = parseEventsPage(await fetchText(fetchFn, EVENTS_PAGE_URL, 'text/html'));
    if (page.events.length > 0) return { source: 'events-page', ...page };
    // An empty agenda is more likely a changed page than a group with no events, so ask the feed too.
    pageFailure = page.problems.length > 0 ? `no readable events (${messages(page.problems)})` : 'no events listed';
  } catch (error) {
    pageFailure = errorMessage(error);
  }

  try {
    const feed = parseIcalFeed(await fetchText(fetchFn, ICAL_FEED_URL, 'text/calendar'));
    return {
      source: 'ical-feed',
      ...feed,
      problems: [{ message: `events page: ${pageFailure}; read the iCal feed instead` }, ...feed.problems],
    };
  } catch (error) {
    throw new MeetupReadError(`events page: ${pageFailure}; iCal feed: ${errorMessage(error)}`);
  }
}

async function fetchText(fetchFn: Fetch, url: string, accept: string): Promise<string> {
  const response = await fetchFn(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function messages(problems: ParsedEvents['problems']): string {
  return problems.map((p) => p.message).join('; ');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
