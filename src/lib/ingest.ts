// Stores what a Meetup read found (plan §9, ingest steps 2 and 4). New events are added and known ones
// updated. A future event that has disappeared from Meetup is marked unlisted, never deleted.
import { and, eq, gt, inArray, isNull, lte, notInArray, type SQL } from 'drizzle-orm';
import type { Database } from './db';
import { events, groupStats } from './db/schema';
import type { GroupRating, MeetupEvent } from './meetup/event';
import { type Fetch, readUpcomingEvents, type UpcomingEvents } from './meetup/read-upcoming';

/** The `group_stats` row's key. */
export const MEETUP_GROUP = 'amsterdam-film-group';

export interface StoreSummary {
  added: number;
  changed: number;
  unchanged: number;
  unlisted: number;
}

export interface IngestSummary extends StoreSummary {
  source: UpcomingEvents['source'];
  read: number;
  coversUntil: string | null;
  groupRating: GroupRating | null;
  problems: UpcomingEvents['problems'];
}

/** One ingest run. Still to come (plan §9): description parsing, film matching, the Healthchecks ping. */
export async function runIngest(db: Database, fetchFn: Fetch, now: Date): Promise<IngestSummary> {
  const read = await readUpcomingEvents(fetchFn);
  const stored = await storeUpcomingEvents(db, read, now);
  const groupRating = read.groupRating ?? null;
  if (groupRating) await storeGroupRating(db, groupRating, now);
  return {
    source: read.source,
    read: read.events.length,
    ...stored,
    coversUntil: read.coversUntil,
    groupRating,
    problems: read.problems,
  };
}

/** The group's average rating; the last one read stays when a read doesn't carry it. */
export async function storeGroupRating(db: Database, rating: GroupRating, now: Date): Promise<void> {
  const fields = { ratingAverage: rating.average, ratingCount: rating.count, readAt: now.toISOString() };
  await db
    .insert(groupStats)
    .values({ id: MEETUP_GROUP, ...fields })
    .onConflictDoUpdate({ target: groupStats.id, set: fields });
}

export async function storeUpcomingEvents(db: Database, read: UpcomingEvents, now: Date): Promise<StoreSummary> {
  const seenAt = now.toISOString();
  const ids = read.events.map((e) => e.id);
  const known = new Map(
    ids.length === 0
      ? []
      : (await db.select({ id: events.id, contentHash: events.contentHash }).from(events).where(inArray(events.id, ids))).map(
          (row) => [row.id, row.contentHash],
        ),
  );

  const summary: StoreSummary = { added: 0, changed: 0, unchanged: 0, unlisted: 0 };
  const writes = [];
  for (const event of read.events) {
    const hash = await contentHash(event);
    const fields = {
      title: event.title,
      url: event.url,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      description: event.description,
      cancelled: event.cancelled,
      contentHash: hash,
      lastSeenAt: seenAt,
      unlistedAt: null,
      // The iCal fallback has no venue, counts or image, so it leaves the last ones read from the page.
      ...(event.pageDetails && {
        meetupVenueId: event.pageDetails.venue?.meetupId ?? null,
        meetupVenueName: event.pageDetails.venue?.name ?? null,
        going: event.pageDetails.going,
        rsvpLimit: event.pageDetails.rsvpLimit,
        coverImageUrl: event.pageDetails.coverImageUrl,
      }),
    };
    const previousHash = known.get(event.id);
    if (previousHash === undefined) {
      writes.push(db.insert(events).values({ id: event.id, ...fields, firstSeenAt: seenAt, changedAt: seenAt }));
      summary.added++;
    } else if (previousHash !== hash) {
      writes.push(db.update(events).set({ ...fields, changedAt: seenAt }).where(eq(events.id, event.id)));
      summary.changed++;
    } else {
      writes.push(db.update(events).set(fields).where(eq(events.id, event.id)));
      summary.unchanged++;
    }
  }
  const [first, ...rest] = writes;
  if (first) await db.batch([first, ...rest]);

  const unlisting = unlistingCondition(read, ids, seenAt);
  if (unlisting) {
    const unlisted = await db.update(events).set({ unlistedAt: seenAt }).where(unlisting).returning({ id: events.id });
    summary.unlisted = unlisted.length;
  }
  return summary;
}

/**
 * Which stored events the read proves gone: listed, still in the future, inside the range the read
 * covers, and neither read nor skipped. Null when the read can't prove anything.
 */
function unlistingCondition(read: UpcomingEvents, ids: string[], now: string): SQL | null {
  // An empty read is more likely a broken source than a group with no events.
  if (read.events.length === 0) return null;
  const skipped = read.problems.filter((p) => p.skipped);
  // A skipped event without an id could be any of them.
  if (skipped.some((p) => p.eventId === undefined)) return null;
  const notRead = [...ids, ...skipped.map((p) => p.eventId as string)];
  return (
    and(
      isNull(events.unlistedAt),
      gt(events.startsAt, now),
      notInArray(events.id, notRead),
      read.coversUntil === null ? undefined : lte(events.startsAt, read.coversUntil),
    ) ?? null
  );
}

/** SHA-256 of the fields that parsing and film matching read, so an unchanged event can be skipped. */
export async function contentHash(event: MeetupEvent): Promise<string> {
  const content = JSON.stringify([event.title, event.url, event.startsAt, event.endsAt, event.description, event.cancelled]);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
