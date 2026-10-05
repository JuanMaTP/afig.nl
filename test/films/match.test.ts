import { describe, expect, it } from 'vitest';
import type { EventFilmClues } from '../../src/lib/films/event-film';
import { matchFilm, namesADirector } from '../../src/lib/films/match';
import { fakeTmdb, film } from './fake-tmdb';

const clues = (titles: string[], year: number | null, directors: string | null): EventFilmClues => ({ titles, year, directors });

const RIVER = film(101, 'A River Runs Through It', 1992, ['Robert Redford']);
const RIVER_DOC = film(102, "Deep Currents: Making 'A River Runs Through It'", 2009, ['Someone Else']);
const FIVE_CM_ANIME = film(201, '5 Centimeters per Second', 2007, ['Makoto Shinkai'], { originalTitle: '秒速5センチメートル' });
const FIVE_CM_LIVE = film(202, '5 Centimeters per Second', 2025, ['Yoshiyuki Okuyama'], { originalTitle: '秒速5センチメートル' });
const FUNNY_GAMES_1997 = film(301, 'Funny Games', 1997, ['Michael Haneke']);
const FUNNY_GAMES_2007 = film(302, 'Funny Games', 2007, ['Michael Haneke']);
const LIVES = film(401, 'The Lives of Others', 2006, ['Florian Henckel von Donnersmarck'], { originalTitle: 'Das Leben der Anderen' });
const WILD_PEAR = film(501, 'The Wild Pear Tree', 2018, ['Nuri Bilge Ceylan'], { alternativeTitles: ['Ahlat Ağacı'] });

const catalogue = [RIVER, RIVER_DOC, FIVE_CM_ANIME, FIVE_CM_LIVE, FUNNY_GAMES_1997, FUNNY_GAMES_2007, LIVES, WILD_PEAR];

describe('matchFilm', () => {
  it('matches on title, year and director', async () => {
    const tmdb = fakeTmdb(catalogue);
    expect(await matchFilm(tmdb, clues(['a river runs through it'], 1992, 'Robert Redford'))).toEqual({ film: RIVER });
  });

  it('tells two films with one title apart by the year and the director', async () => {
    const tmdb = fakeTmdb(catalogue);
    const result = await matchFilm(tmdb, clues(['5 centimeters per second'], 2025, 'Yoshiyuki Okuyama'));
    expect(result).toEqual({ film: FIVE_CM_LIVE });
  });

  it('accepts a release year one off the stated one', async () => {
    const tmdb = fakeTmdb(catalogue);
    expect(await matchFilm(tmdb, clues(['a river runs through it'], 1991, 'Robert Redford'))).toEqual({ film: RIVER });
  });

  it('rejects a film whose director the event does not name', async () => {
    const tmdb = fakeTmdb(catalogue);
    expect(await matchFilm(tmdb, clues(['a river runs through it'], 1992, 'Brad Pitt'))).toEqual({ problem: 'no-match' });
  });

  it('rejects a film whose year is further off', async () => {
    const tmdb = fakeTmdb(catalogue);
    expect(await matchFilm(tmdb, clues(['a river runs through it'], 1995, 'Robert Redford'))).toEqual({ problem: 'no-match' });
  });

  it('matches without a year only when one film agrees', async () => {
    const tmdb = fakeTmdb(catalogue);
    expect(await matchFilm(tmdb, clues(['a river runs through it'], null, 'Robert Redford'))).toEqual({ film: RIVER });
    expect(await matchFilm(tmdb, clues(['funny games'], null, 'Michael Haneke'))).toEqual({ problem: 'ambiguous' });
    expect(await matchFilm(tmdb, clues(['funny games'], 2007, 'Michael Haneke'))).toEqual({ film: FUNNY_GAMES_2007 });
  });

  it("prefers the one film with the very year stated, over the director's short from the year after", async () => {
    const film2000 = film(601, 'In the Mood for Love', 2000, ['Wong Kar-Wai']);
    const short2001 = film(602, '@ in the mood for love', 2001, ['Wong Kar-Wai']);
    const tmdb = fakeTmdb([film2000, short2001]);
    expect(await matchFilm(tmdb, clues(['in the mood for love'], 2000, 'Wong Kar-wai'))).toEqual({ film: film2000 });
    expect(await matchFilm(tmdb, clues(['in the mood for love'], 1999, 'Wong Kar-wai'))).toEqual({ film: film2000 });
    expect(await matchFilm(tmdb, clues(['in the mood for love'], null, 'Wong Kar-wai'))).toEqual({ problem: 'ambiguous' });
  });

  it('matches the original or an alternative title', async () => {
    const tmdb = fakeTmdb(catalogue);
    expect(await matchFilm(tmdb, clues(['das leben der anderen'], 2006, 'Florian Henckel von Donnersmarck'))).toEqual({
      film: LIVES,
    });
    expect(await matchFilm(tmdb, clues(['ahlat agaci'], 2018, 'Nuri Bilge Ceylan'))).toEqual({ film: WILD_PEAR });
  });

  it('never matches on a title that only contains the event title', async () => {
    const tmdb = fakeTmdb(catalogue);
    expect(await matchFilm(tmdb, clues(['making a river runs through it'], 2009, 'Someone Else'))).toEqual({
      problem: 'no-match',
    });
  });

  it('needs a director and a title before it searches', async () => {
    const tmdb = fakeTmdb(catalogue);
    expect(await matchFilm(tmdb, clues(['oldboy'], 2003, null))).toEqual({ problem: 'no-director' });
    expect(await matchFilm(tmdb, clues([], 2003, 'Park Chan-wook'))).toEqual({ problem: 'no-title' });
    expect(tmdb.requests).toEqual([]);
  });

  it('searches with the year when the first page has no film of that year', async () => {
    const tmdb = fakeTmdb([...Array.from({ length: 3 }, (_, i) => film(900 + i, 'Nosferatu', 1922 + i, ['Other'])), film(950, 'Nosferatu', 2024, ['Robert Eggers'])]);
    const original = tmdb.searchMovies.bind(tmdb);
    // The first page stops before the 2024 film, as TMDB's would with a crowded title.
    tmdb.searchMovies = async (query, year) => (await original(query, year)).filter((r) => year !== undefined || r.id !== 950);
    expect(await matchFilm(tmdb, clues(['nosferatu'], 2024, 'Robert Eggers'))).toMatchObject({ film: { id: 950 } });
  });
});

describe('namesADirector', () => {
  it.each([
    ['Robert Redford', ['Robert Redford'], true],
    ['Joel Coen & Ethan Coen', ['Ethan Coen', 'Joel Coen'], true],
    ['Alejandro G. Iñárritu', ['Alejandro González Iñárritu'], true],
    ['Wong Kar Wai', ['Wong Kar-wai'], true],
    ['Chloe Zhao', ['Chloé Zhao'], true],
    ['Hikari', ['Hikari'], true],
    ['Spike Lee, Do the Right Thing is a cult classic from 1989', ['Spike Lee'], true],
    ['Russo brothers', ['Anthony Russo', 'Joe Russo'], false],
    ['Jon Favreau', ['John Favreau'], false],
    ['Robert Redfordson', ['Robert Redford'], false],
  ])('%s names %j: %s', (line, directors, expected) => {
    expect(namesADirector(line, directors)).toBe(expected);
  });
});
