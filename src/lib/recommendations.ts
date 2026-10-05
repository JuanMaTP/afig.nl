// Recommendations (plan §5.3): a film for the group, or a screening a member spotted. Members who sign in send
// them; only the hosts read them. A member sees their own recommendations, never anyone else's nor how many
// a film has, so what others chose can't sway them (decided 4 October 2026). Plain module: the pages pass in
// the database and the signed-in member.
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, max, sql } from 'drizzle-orm';
import { z } from 'astro/zod';
import type { Database } from './db';
import { events, films, recommendations, recommendedFilms, screeningTips, users } from './db/schema';

/** A line on why, or what a tip is: enough for a sentence or two. */
export const NOTE_LENGTH = 500;
export const URL_LENGTH = 500;
/** More in a day than a member would send, so a mistake or a script can't fill the hosts' list. */
export const RECOMMENDATIONS_PER_DAY = 30;
export const TIPS_PER_DAY = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A note as typed: trimmed, blank lines squeezed; null when empty. */
export function cleanNote(text: string | null | undefined): string | null {
  const note = (text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return note === '' ? null : note;
}

const noteSchema = z
  .string()
  .nullish()
  .transform(cleanNote)
  .refine((note) => note === null || note.length <= NOTE_LENGTH, `Please keep it under ${NOTE_LENGTH} characters.`);

const tipSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Paste the link to the screening or the venue.')
    .max(URL_LENGTH, 'That link is too long.')
    .transform((text, ctx) => {
      const url = webUrl(text);
      if (!url) ctx.addIssue({ code: 'custom', message: 'That doesn’t look like a web address. Paste the whole link, starting with https://' });
      return url ?? '';
    }),
  note: noteSchema,
});

/** An http(s) address as typed, with "https://" added when it was left out; null for anything else. */
export function webUrl(text: string): string | null {
  const written = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(written);
  } catch {
    return null;
  }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.') || url.username || url.password) return null;
  return url.href;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: Partial<Record<string, string>> };

function parsed<T>(result: z.ZodSafeParseResult<T>): Parsed<T> {
  if (result.success) return { ok: true, value: result.data };
  const errors: Partial<Record<string, string>> = {};
  for (const issue of result.error.issues) errors[String(issue.path[0] ?? 'form')] ??= issue.message;
  return { ok: false, errors };
}

export function parseTip(form: FormData): Parsed<{ url: string; note: string | null }> {
  return parsed(tipSchema.safeParse({ url: form.get('url') ?? '', note: form.get('note') }));
}

export function parseNote(form: FormData): Parsed<{ note: string | null }> {
  return parsed(z.object({ note: noteSchema }).safeParse({ note: form.get('note') }));
}

/** Records the member's recommendation, or updates its note. The film enters the hosts' list the first time. */
export async function recommend(db: Database, userId: string, filmId: number, note: string | null, now: Date): Promise<void> {
  const at = now.toISOString();
  await db.batch([
    db.insert(recommendedFilms).values({ filmId, createdAt: at }).onConflictDoNothing(),
    db
      .insert(recommendations)
      .values({ filmId, userId, note, createdAt: at, updatedAt: at })
      .onConflictDoUpdate({ target: [recommendations.filmId, recommendations.userId], set: { note, updatedAt: at } }),
  ]);
}

/** Withdraws the member's recommendation of a film (by TMDB id). The film stays known to the site. */
export async function withdraw(db: Database, userId: string, tmdbId: number): Promise<void> {
  await db
    .delete(recommendations)
    .where(
      and(
        eq(recommendations.userId, userId),
        inArray(
          recommendations.filmId,
          db
            .select({ id: films.id })
            .from(films)
            .where(and(eq(films.tmdbKind, 'movie'), eq(films.tmdbId, tmdbId))),
        ),
      ),
    );
}

/** Whether the member may send another recommendation, or another tip, today. */
export async function canRecommend(db: Database, userId: string, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const [row] = await db
    .select({ n: count() })
    .from(recommendations)
    .where(and(eq(recommendations.userId, userId), gt(recommendations.createdAt, since)));
  return (row?.n ?? 0) < RECOMMENDATIONS_PER_DAY;
}

export async function canSendTip(db: Database, userId: string, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const [row] = await db
    .select({ n: count() })
    .from(screeningTips)
    .where(and(eq(screeningTips.userId, userId), gt(screeningTips.createdAt, since)));
  return (row?.n ?? 0) < TIPS_PER_DAY;
}

export async function sendTip(db: Database, userId: string, tip: { url: string; note: string | null }, now: Date): Promise<void> {
  await db.insert(screeningTips).values({ userId, url: tip.url, note: tip.note, createdAt: now.toISOString() });
}

/** The member's own recommendation of a film (by TMDB id), if they made one. */
export async function ownRecommendation(db: Database, userId: string, tmdbId: number): Promise<{ note: string | null; createdAt: string } | null> {
  const [row] = await db
    .select({ note: recommendations.note, createdAt: recommendations.createdAt })
    .from(recommendations)
    .innerJoin(films, eq(films.id, recommendations.filmId))
    .where(and(eq(recommendations.userId, userId), eq(films.tmdbKind, 'movie'), eq(films.tmdbId, tmdbId)));
  return row ?? null;
}

export interface OwnRecommendation {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  note: string | null;
  createdAt: string;
}

/** The member's own recommendations, the latest first. */
export async function ownRecommendations(db: Database, userId: string): Promise<OwnRecommendation[]> {
  const rows = await db
    .select({
      tmdbId: films.tmdbId,
      title: films.title,
      year: films.year,
      posterPath: films.posterPath,
      note: recommendations.note,
      createdAt: recommendations.createdAt,
    })
    .from(recommendations)
    .innerJoin(films, eq(films.id, recommendations.filmId))
    .where(and(eq(recommendations.userId, userId), eq(films.tmdbKind, 'movie'), isNotNull(films.tmdbId)))
    .orderBy(desc(recommendations.createdAt));
  return rows.map((row) => ({ ...row, tmdbId: row.tmdbId! }));
}

// For the hosts (plan §5.9): who recommended what and why, and the tips.

export interface HostFilm {
  filmId: number;
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** How many members recommend it. */
  members: number;
  /** The latest recommendation. */
  lastAt: string;
  /** A host set it aside (done, or not for the group); its recommendations stay. */
  setAside: boolean;
  notes: { name: string; email: string; note: string | null; createdAt: string }[];
  /** The group's latest event with this film, past or upcoming. */
  lastEvent: { startsAt: string; url: string } | null;
}

/** How the hosts sort the films: the most recommended first (the default), or the latest recommended first. */
export type FilmOrder = 'most' | 'latest';

export async function hostFilmList(db: Database, order: FilmOrder = 'most'): Promise<HostFilm[]> {
  const rows = await db
    .select({
      filmId: films.id,
      tmdbId: films.tmdbId,
      title: films.title,
      year: films.year,
      posterPath: films.posterPath,
      hiddenAt: recommendedFilms.hiddenAt,
      name: users.name,
      email: users.email,
      note: recommendations.note,
      createdAt: recommendations.createdAt,
    })
    .from(recommendedFilms)
    .innerJoin(films, eq(films.id, recommendedFilms.filmId))
    .innerJoin(recommendations, eq(recommendations.filmId, recommendedFilms.filmId))
    .innerJoin(users, eq(users.id, recommendations.userId))
    .where(and(eq(films.tmdbKind, 'movie'), isNotNull(films.tmdbId)))
    .orderBy(desc(recommendations.createdAt));
  // SQLite takes a bare column (the url) from the row that gave the max().
  const lastEvents = await db
    .select({ filmId: events.filmId, startsAt: max(events.startsAt), url: sql<string>`${events.url}` })
    .from(events)
    .innerJoin(recommendedFilms, eq(recommendedFilms.filmId, events.filmId))
    .where(eq(events.cancelled, false))
    .groupBy(events.filmId);
  const eventOf = new Map(lastEvents.map((e) => [e.filmId, { startsAt: e.startsAt!, url: e.url }]));

  const byFilm = new Map<number, HostFilm>();
  for (const row of rows) {
    let film = byFilm.get(row.filmId);
    if (!film) {
      film = {
        filmId: row.filmId,
        tmdbId: row.tmdbId!,
        title: row.title,
        year: row.year,
        posterPath: row.posterPath,
        members: 0,
        lastAt: row.createdAt,
        setAside: row.hiddenAt !== null,
        notes: [],
        lastEvent: eventOf.get(row.filmId) ?? null,
      };
      byFilm.set(row.filmId, film);
    }
    film.members++;
    film.notes.push({ name: row.name, email: row.email, note: row.note, createdAt: row.createdAt });
  }
  // The rows come the latest first, so the map is in that order already; ties keep it.
  const list = [...byFilm.values()];
  return order === 'most' ? list.sort((x, y) => y.members - x.members) : list;
}

/** Sets a film aside, or brings it back. */
export async function setAside(db: Database, filmId: number, aside: boolean, now: Date): Promise<void> {
  await db
    .update(recommendedFilms)
    .set({ hiddenAt: aside ? now.toISOString() : null })
    .where(eq(recommendedFilms.filmId, filmId));
}

export interface HostTip {
  id: number;
  url: string;
  note: string | null;
  createdAt: string;
  doneAt: string | null;
  name: string;
  email: string;
}

/** Every open tip, the latest first, then the latest done ones. */
export async function hostTips(db: Database, doneLimit = 50): Promise<{ open: HostTip[]; done: HostTip[] }> {
  const fields = {
    id: screeningTips.id,
    url: screeningTips.url,
    note: screeningTips.note,
    createdAt: screeningTips.createdAt,
    doneAt: screeningTips.doneAt,
    name: users.name,
    email: users.email,
  };
  const [open, done] = await Promise.all([
    db.select(fields).from(screeningTips).innerJoin(users, eq(users.id, screeningTips.userId)).where(isNull(screeningTips.doneAt)).orderBy(desc(screeningTips.createdAt)),
    db
      .select(fields)
      .from(screeningTips)
      .innerJoin(users, eq(users.id, screeningTips.userId))
      .where(isNotNull(screeningTips.doneAt))
      .orderBy(desc(screeningTips.doneAt))
      .limit(doneLimit),
  ]);
  return { open, done };
}

export async function setTipDone(db: Database, id: number, done: boolean, now: Date): Promise<void> {
  await db
    .update(screeningTips)
    .set({ doneAt: done ? now.toISOString() : null })
    .where(eq(screeningTips.id, id));
}

/** What waits for the hosts: open tips, films recommended in the last week, and films recommended and not set aside. */
export async function hostCounts(db: Database, now: Date): Promise<{ openTips: number; newFilms: number; recommended: number }> {
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS).toISOString();
  const [[tips], [fresh], [recommended]] = await Promise.all([
    db.select({ n: count() }).from(screeningTips).where(isNull(screeningTips.doneAt)),
    db
      .select({ n: sql<number>`count(distinct ${recommendations.filmId})` })
      .from(recommendations)
      .where(gt(recommendations.createdAt, weekAgo)),
    db
      .select({ n: sql<number>`count(distinct ${recommendedFilms.filmId})` })
      .from(recommendedFilms)
      .innerJoin(recommendations, eq(recommendations.filmId, recommendedFilms.filmId))
      .where(isNull(recommendedFilms.hiddenAt)),
  ]);
  return { openTips: tips?.n ?? 0, newFilms: fresh?.n ?? 0, recommended: recommended?.n ?? 0 };
}
