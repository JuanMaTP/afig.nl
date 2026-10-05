// Reads the group's events page. Every upcoming event sits in its __NEXT_DATA__ block, in a flat
// Apollo map of `Event:<id>`, `Venue:<id>` and `PhotoInfo:<id>` objects linked by `{ __ref }` (plan §4).
// The schemas pick the fields the site uses; z.object drops every other key, so attendees, hosts
// and the creator never get past them (docs/engineering.md, Launch mode 3).
import { z } from 'astro/zod';
import { toUtcIso } from '../time';
import {
  type GroupRating,
  latestStart,
  MEETUP_EVENT_URL,
  MEETUP_IMAGE_HOST,
  MeetupFormatError,
  type MeetupEvent,
  type MeetupProblem,
  type MeetupVenue,
  type ParsedEvents,
} from './event';

export const EVENTS_PAGE_URL = 'https://www.meetup.com/amsterdam-film-group/events/?type=upcoming';

const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json"[^>]*>([\s\S]*?)<\/script>/;

const ref = z.object({ __ref: z.string() });
const record = z.record(z.string(), z.unknown());

const pageSchema = z.object({
  props: z.object({ pageProps: z.object({ __APOLLO_STATE__: record }) }),
});

const upcomingListSchema = z.object({
  edges: z.array(z.object({ node: ref })),
  pageInfo: z.object({ hasNextPage: z.boolean() }),
});

const eventSchema = z.object({
  id: z.string().regex(/^\d+$/),
  title: z.string().trim().min(1),
  eventUrl: z.string().regex(MEETUP_EVENT_URL),
  description: z.string().nullish(),
  dateTime: z.iso.datetime({ offset: true }),
  endTime: z.iso.datetime({ offset: true }).nullish(),
  status: z.string(),
  venue: ref.nullish(),
  going: z.object({ totalCount: z.number().int().nonnegative() }),
  maxTickets: z.number().int().nonnegative(),
  featuredEventPhoto: ref.nullish(),
});

// The group's own figures (seen 3 October 2026): `stats.eventRatings` is the average of the ratings
// members give events afterwards. Only the average and the count; no rating is tied to a member here.
const groupRatingSchema = z.object({
  stats: z.object({
    eventRatings: z.object({ average: z.number().min(0).max(5), total: z.number().int().nonnegative() }),
  }),
});

const venueSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  address: z.string().nullish(),
  city: z.string().nullish(),
});

const photoSchema = z.object({
  highResUrl: z.url({ protocol: /^https$/, hostname: MEETUP_IMAGE_HOST }),
});

/** Throws a MeetupFormatError when the page isn't the events page as we know it. */
export function parseEventsPage(html: string): ParsedEvents {
  const json = NEXT_DATA.exec(html)?.[1];
  if (json === undefined) throw new MeetupFormatError('no __NEXT_DATA__ block');
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new MeetupFormatError('__NEXT_DATA__ is not JSON');
  }
  const page = pageSchema.safeParse(data);
  if (!page.success) throw new MeetupFormatError('no __APOLLO_STATE__ in __NEXT_DATA__');
  const state = page.data.props.pageProps.__APOLLO_STATE__;

  const group = groupOf(state);
  const list = upcomingList(group);
  const events: MeetupEvent[] = [];
  const problems: MeetupProblem[] = [];
  if (list.pageInfo.hasNextPage) {
    problems.push({ message: `the events page lists more than ${list.edges.length} events; only those were read` });
  }
  for (const { node } of list.edges) {
    const eventId = node.__ref.replace(/^Event:/, '');
    const parsed = eventSchema.safeParse(state[node.__ref]);
    if (!parsed.success) {
      problems.push({ eventId, skipped: true, message: `event not readable: ${z.prettifyError(parsed.error)}` });
      continue;
    }
    const e = parsed.data;
    events.push({
      id: e.id,
      title: e.title,
      url: e.eventUrl,
      startsAt: toUtcIso(e.dateTime),
      endsAt: e.endTime ? toUtcIso(e.endTime) : null,
      description: e.description ?? '',
      cancelled: e.status === 'CANCELLED',
      pageDetails: {
        venue: e.venue ? venue(state[e.venue.__ref], e.id, problems) : null,
        going: e.going.totalCount,
        rsvpLimit: e.maxTickets > 0 ? e.maxTickets : null,
        coverImageUrl: e.featuredEventPhoto ? coverImage(state[e.featuredEventPhoto.__ref], e.id, problems) : null,
      },
    });
  }
  return {
    events,
    groupRating: groupRating(group),
    coversUntil: list.pageInfo.hasNextPage ? latestStart(events) : null,
    problems,
  };
}

/** The group the page is about. */
function groupOf(state: Record<string, unknown>): Record<string, unknown> {
  const root = record.safeParse(state.ROOT_QUERY);
  const groupRef = root.success
    ? ref.safeParse(Object.entries(root.data).find(([key]) => key.startsWith('groupByUrlname:'))?.[1])
    : undefined;
  const group = groupRef?.success ? record.safeParse(state[groupRef.data.__ref]) : undefined;
  if (!group?.success) throw new MeetupFormatError('no group in __APOLLO_STATE__');
  return group.data;
}

/** The group's list of upcoming events, in the order the page shows them. */
function upcomingList(group: Record<string, unknown>): z.infer<typeof upcomingListSchema> {
  // The key carries the query, e.g. events({"filter":{"afterDateTime":"…","status":["ACTIVE",…]},"first":30,…}).
  const listKey = Object.keys(group).find((key) => key.startsWith('events(') && key.includes('"afterDateTime"'));
  const list = upcomingListSchema.safeParse(listKey === undefined ? undefined : group[listKey]);
  if (!list.success) throw new MeetupFormatError('no list of upcoming events in the group');
  return list.data;
}

/** Null when the page doesn't show it: the rating is a nicety, so its absence isn't a problem to report. */
function groupRating(group: Record<string, unknown>): GroupRating | null {
  const parsed = groupRatingSchema.safeParse(group);
  if (!parsed.success) return null;
  const { average, total } = parsed.data.stats.eventRatings;
  return { average, count: total };
}

function venue(value: unknown, eventId: string, problems: MeetupProblem[]): MeetupVenue | null {
  const parsed = venueSchema.safeParse(value);
  if (!parsed.success) {
    problems.push({ eventId, message: 'venue not readable; left out' });
    return null;
  }
  const { id, name, address, city } = parsed.data;
  return { meetupId: id, name, address: address || null, city: city || null };
}

function coverImage(value: unknown, eventId: string, problems: MeetupProblem[]): string | null {
  const parsed = photoSchema.safeParse(value);
  if (!parsed.success) {
    problems.push({ eventId, message: 'cover image not readable; left out' });
    return null;
  }
  return parsed.data.highResUrl;
}
