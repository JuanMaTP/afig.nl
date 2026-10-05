// One upcoming Meetup event, as both sources give it, before its description is parsed.
// Personal data (attendees, hosts, the creator) never gets this far: the source parsers drop it.

export interface MeetupEvent {
  /** Meetup's event id: the stable key for upserts and the archive. */
  id: string;
  /** The full title, language bracket included. */
  title: string;
  url: string;
  /** The meetup time (the `When:` line), as a UTC ISO string. Never the film start. */
  startsAt: string;
  /** The end the host set, as a UTC ISO string. */
  endsAt: string | null;
  /** The host's description, in Meetup's Markdown. */
  description: string;
  cancelled: boolean;
  /** Only the events page carries these; events read from the iCal fallback have none. */
  pageDetails?: MeetupPageDetails;
}

export interface MeetupPageDetails {
  venue: MeetupVenue | null;
  going: number;
  /** Meetup's `maxTickets`; null when the event has no RSVP limit. */
  rsvpLimit: number | null;
  /** The host's cover image. */
  coverImageUrl: string | null;
}

export interface MeetupVenue {
  /** Map it through the `venues` aliases: Meetup has the same cinema under several ids. */
  meetupId: string;
  name: string;
  address: string | null;
  city: string | null;
}

export interface MeetupProblem {
  /** The event it concerns, if one. */
  eventId?: string;
  /** The event was left out entirely. It is still listed on Meetup, so it must not be marked unlisted. */
  skipped?: boolean;
  message: string;
}

/** The group's average event rating on Meetup, from its members' feedback after events. */
export interface GroupRating {
  /** Out of 5. */
  average: number;
  count: number;
}

export interface ParsedEvents {
  events: MeetupEvent[];
  /** Only the events page carries it; null when the page doesn't show it. */
  groupRating?: GroupRating | null;
  /**
   * Null when the list holds every upcoming event. Otherwise the start of the last event read:
   * a later event may simply not have been read, so only earlier ones can be judged missing (plan §9, ingest step 4).
   */
  coversUntil: string | null;
  problems: MeetupProblem[];
}

/** The latest start among the events read: UTC ISO strings compare as text. */
export function latestStart(events: MeetupEvent[]): string | null {
  return events.reduce<string | null>((latest, e) => (latest === null || e.startsAt > latest ? e.startsAt : latest), null);
}

/** The page or the feed isn't what the parser expects: Meetup changed it, or served something else. */
export class MeetupFormatError extends Error {
  override name = 'MeetupFormatError';
}

/** Event URLs and images must point to Meetup, so a changed or odd value can't put a foreign link on the site. */
export const MEETUP_EVENT_URL = /^https:\/\/www\.meetup\.com\/amsterdam-film-group\/events\/\d+\/?$/;
export const MEETUP_IMAGE_HOST = /^([a-z0-9-]+\.)*meetupstatic\.com$/;
