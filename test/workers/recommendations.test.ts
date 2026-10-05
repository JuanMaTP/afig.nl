import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { database } from '../../src/cloudflare';
import { events, films, recommendations, recommendedFilms, screeningTips, users } from '../../src/lib/db/schema';
import {
  canRecommend,
  canSendTip,
  hostCounts,
  hostFilmList,
  hostTips,
  ownRecommendation,
  ownRecommendations,
  recommend,
  RECOMMENDATIONS_PER_DAY,
  sendTip,
  setAside,
  setTipDone,
  TIPS_PER_DAY,
  withdraw,
} from '../../src/lib/recommendations';

const db = database();
const now = new Date('2026-10-04T12:00:00.000Z');
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

async function addMember(id: string, name: string) {
  await db.insert(users).values({ id, name, email: `${id}@example.com`, emailVerified: true, createdAt: now, updatedAt: now });
}

async function addFilm(tmdbId: number, title: string): Promise<number> {
  const [row] = await db
    .insert(films)
    .values({ tmdbKind: 'movie', tmdbId, imdbId: `tt${tmdbId}`, title, year: 1990, refreshedAt: now.toISOString() })
    .returning({ id: films.id });
  return row!.id;
}

let akira: number;
let stalker: number;

beforeEach(async () => {
  await db.delete(recommendations);
  await db.delete(recommendedFilms);
  await db.delete(screeningTips);
  await db.delete(events);
  await db.delete(films);
  await db.delete(users);
  await addMember('ana', 'Ana');
  await addMember('bo', 'Bo');
  akira = await addFilm(149, 'Akira');
  stalker = await addFilm(1398, 'Stalker');
});

describe('recommend', () => {
  it('shows a member only their own recommendations, the latest first', async () => {
    await recommend(db, 'ana', stalker, 'Tarkovsky on a big screen', now);
    await recommend(db, 'ana', akira, null, later(1));
    await recommend(db, 'bo', akira, 'The 4K restoration', later(2));

    expect(await ownRecommendations(db, 'ana')).toEqual([
      { tmdbId: 149, title: 'Akira', year: 1990, posterPath: null, note: null, createdAt: later(1).toISOString() },
      { tmdbId: 1398, title: 'Stalker', year: 1990, posterPath: null, note: 'Tarkovsky on a big screen', createdAt: now.toISOString() },
    ]);
    expect(await ownRecommendations(db, 'bo')).toMatchObject([{ tmdbId: 149, note: 'The 4K restoration' }]);
  });

  it('changes the note when the member recommends again, and keeps the first date', async () => {
    await recommend(db, 'ana', akira, 'First', now);
    await recommend(db, 'ana', akira, 'Second', later(10));
    expect(await ownRecommendation(db, 'ana', 149)).toEqual({ note: 'Second', createdAt: now.toISOString() });
    expect(await ownRecommendation(db, 'bo', 149)).toBeNull();
    expect(await hostFilmList(db)).toMatchObject([{ members: 1, notes: [{ note: 'Second' }] }]);
  });

  it('drops a film from the hosts’ list when its last member withdraws', async () => {
    await recommend(db, 'ana', akira, null, now);
    await recommend(db, 'bo', akira, null, now);
    await withdraw(db, 'ana', 149);
    expect(await ownRecommendations(db, 'ana')).toEqual([]);
    expect(await hostFilmList(db)).toMatchObject([{ members: 1 }]);
    await withdraw(db, 'bo', 149);
    expect(await hostFilmList(db)).toEqual([]);
    // Recommending it again brings it back.
    await recommend(db, 'bo', akira, null, later(5));
    expect(await hostFilmList(db)).toMatchObject([{ tmdbId: 149, members: 1 }]);
  });

  it('lets a host set a film aside and bring it back', async () => {
    await recommend(db, 'ana', akira, null, now);
    await recommend(db, 'ana', stalker, null, now);
    await setAside(db, akira, true, now);
    expect((await hostFilmList(db)).map((f) => [f.title, f.setAside])).toEqual(
      expect.arrayContaining([
        ['Akira', true],
        ['Stalker', false],
      ]),
    );
    expect(await hostCounts(db, now)).toMatchObject({ recommended: 1 });
    await setAside(db, akira, false, now);
    expect((await hostFilmList(db)).every((f) => !f.setAside)).toBe(true);
  });

  it('limits how many films a member recommends in a day', async () => {
    const values = Array.from({ length: RECOMMENDATIONS_PER_DAY }, (_, i) => i);
    for (const i of values) {
      const film = await addFilm(10_000 + i, `Film ${i}`);
      await recommend(db, 'ana', film, null, later(i));
    }
    expect(await canRecommend(db, 'ana', later(60))).toBe(false);
    expect(await canRecommend(db, 'bo', later(60))).toBe(true);
    expect(await canRecommend(db, 'ana', later(24 * 60 + 60))).toBe(true);
  });
});

describe('the hosts’ film list', () => {
  it('shows who recommended each film and why, with the group’s last event', async () => {
    await recommend(db, 'ana', stalker, 'Tarkovsky', now);
    await recommend(db, 'bo', akira, '4K', later(1));
    await recommend(db, 'ana', akira, null, later(2));
    await db.insert(events).values({
      id: 'e1',
      title: 'Akira (Japanese w/ English Subtitles)',
      url: 'https://www.meetup.com/amsterdam-film-group/events/e1/',
      startsAt: '2026-11-01T18:00:00.000Z',
      description: '',
      cancelled: false,
      contentHash: 'h',
      firstSeenAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
      changedAt: now.toISOString(),
      filmId: akira,
    });

    const list = await hostFilmList(db);
    expect(list.map((f) => f.title)).toEqual(['Akira', 'Stalker']);
    expect((await hostFilmList(db, 'latest')).map((f) => f.title)).toEqual(['Akira', 'Stalker']);
    expect(list[0]).toMatchObject({
      members: 2,
      setAside: false,
      lastEvent: { startsAt: '2026-11-01T18:00:00.000Z', url: 'https://www.meetup.com/amsterdam-film-group/events/e1/' },
      notes: [
        { name: 'Ana', email: 'ana@example.com', note: null },
        { name: 'Bo', email: 'bo@example.com', note: '4K' },
      ],
    });
    expect(list[1]).toMatchObject({ members: 1, lastEvent: null, notes: [{ name: 'Ana', note: 'Tarkovsky' }] });
  });
});

describe('the hosts’ order', () => {
  it('puts the most recommended first, or the latest', async () => {
    await recommend(db, 'ana', akira, null, now);
    await recommend(db, 'bo', akira, null, later(1));
    await recommend(db, 'ana', stalker, null, later(2));
    expect((await hostFilmList(db)).map((f) => [f.title, f.members])).toEqual([
      ['Akira', 2],
      ['Stalker', 1],
    ]);
    expect((await hostFilmList(db, 'latest')).map((f) => f.title)).toEqual(['Stalker', 'Akira']);
  });
});

describe('screening tips', () => {
  it('go to the hosts, open first, and move between open and done', async () => {
    await sendTip(db, 'ana', { url: 'https://cinemercator.nl/', note: 'Wednesdays' }, now);
    await sendTip(db, 'bo', { url: 'https://oedipus.com/', note: null }, later(1));

    let tips = await hostTips(db);
    expect(tips.open.map((t) => [t.url, t.name])).toEqual([
      ['https://oedipus.com/', 'Bo'],
      ['https://cinemercator.nl/', 'Ana'],
    ]);
    expect(tips.done).toEqual([]);

    await setTipDone(db, tips.open[1]!.id, true, later(5));
    tips = await hostTips(db);
    expect(tips.open).toHaveLength(1);
    expect(tips.done).toMatchObject([{ url: 'https://cinemercator.nl/', email: 'ana@example.com', doneAt: later(5).toISOString() }]);

    await setTipDone(db, tips.done[0]!.id, false, later(6));
    expect((await hostTips(db)).open).toHaveLength(2);
  });

  it('are limited per member per day', async () => {
    for (let i = 0; i < TIPS_PER_DAY; i++) await sendTip(db, 'ana', { url: `https://example.org/${i}`, note: null }, later(i));
    expect(await canSendTip(db, 'ana', later(30))).toBe(false);
    expect(await canSendTip(db, 'bo', later(30))).toBe(true);
  });
});

describe('hostCounts', () => {
  it('counts open tips, films recommended this week and films on the list', async () => {
    await recommend(db, 'ana', stalker, null, new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000));
    await recommend(db, 'ana', akira, null, now);
    await sendTip(db, 'bo', { url: 'https://example.org/', note: null }, now);
    expect(await hostCounts(db, later(1))).toEqual({ openTips: 1, newFilms: 1, recommended: 2 });
  });
});

describe('deleting a member', () => {
  it('deletes what they sent with them', async () => {
    await recommend(db, 'ana', akira, 'Mine', now);
    await recommend(db, 'bo', akira, null, now);
    await sendTip(db, 'ana', { url: 'https://example.org/', note: null }, now);

    await db.delete(users).where(eq(users.id, 'ana'));

    expect(await db.select().from(screeningTips)).toEqual([]);
    expect(await hostFilmList(db)).toMatchObject([{ members: 1, notes: [{ name: 'Bo' }] }]);
  });
});
