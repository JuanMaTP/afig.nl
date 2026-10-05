// The lines are as hosts wrote them in the events stored by 3 October 2026.
import { describe, expect, it } from 'vitest';
import { EK } from '../../src/lib/films/ek';
import { readEventFilm } from '../../src/lib/films/event-film';

describe('EK (copied from AFG-Matcher.md)', () => {
  it('cleans an event title down to the film', () => {
    expect(EK('Film & Food: Amélie (French w/ English subtitles)').disp).toBe('amelie');
    expect(EK('Gladiator II - IMAX').disp).toBe('gladiator ii');
    expect(EK('La Piscine (1969)')).toMatchObject({ disp: 'la piscine', n: 'piscine', y: '1969' });
  });

  it('cuts off a title with a language word or "with", which is why it never matches alone', () => {
    expect(EK('The English Patient (English w/ Dutch subtitles)').disp).toBe('the');
    expect(EK('Interview with the Vampire').disp).toBe('interview');
  });
});

describe('readEventFilm', () => {
  it('reads the labeled lines', () => {
    const clues = readEventFilm(
      'A River Runs Through It (English without Subtitles)',
      'When: 18:10\nDirected by: Robert Redford\nYear: 1992\nWhere: FilmHallen',
    );
    expect(clues).toEqual({ titles: ['a river runs through it'], year: 1992, directors: 'Robert Redford' });
  });

  it('reads bold labels, a link after the year and a sentence after the director', () => {
    const clues = readEventFilm(
      '5 Centimeters Per Second (Japanese w/ English Subtitles)',
      '**Directed** by: Yoshiyuki Okuyama\n**Year**: 2025 [JFDB](https://jfdb.jp/en/title/10392)',
    );
    expect(clues).toMatchObject({ year: 2025, directors: 'Yoshiyuki Okuyama' });
    expect(readEventFilm('Perfect Days', 'Directed by Wim Wenders, Perfect Days is a contemplative portrait.').directors).toBe(
      'Wim Wenders, Perfect Days is a contemplative portrait.',
    );
    expect(readEventFilm('X', 'Directed: Carlos Saura').directors).toBe('Carlos Saura');
  });

  it('takes the first year of a line, and none when two lines disagree', () => {
    expect(readEventFilm('Do the Right Thing', 'Year: 1989, re-release in 2026').year).toBe(1989);
    expect(readEventFilm('X', 'Year: 1981\nYear: 1982').year).toBeNull();
  });

  it('falls back to a year in the title', () => {
    expect(readEventFilm('La Piscine (1969)', 'Directed by: Jacques Deray').year).toBe(1969);
  });

  it('searches the title without its brackets when EK cuts it off', () => {
    expect(readEventFilm('The English Patient (English w/ Dutch subtitles)', '').titles).toEqual(['The English Patient']);
  });

  it('searches the part after a strand label', () => {
    expect(readEventFilm('Daytime Cinema | The Teacher Who Promised the Sea (2023)', '').titles).toContain(
      'the teacher who promised the sea',
    );
  });

  it('also searches the title without the occasion a host added', () => {
    expect(readEventFilm("Kiki's Delivery Service, Re-release in IMAX, Japanese with English Subtitles", '').titles).toContain(
      "Kiki's Delivery Service",
    );
    expect(readEventFilm('Amadeus & 1,000 Member Celebration (English w/ Dutch Subtitles)', '').titles).toContain('Amadeus');
    expect(readEventFilm('Christiane F. 45th Anniversary - English Subtitles', '').titles).toContain('Christiane F.');
  });

  it('has no director or year when the description names none', () => {
    expect(readEventFilm('Oldboy', 'A cult classic.')).toMatchObject({ year: null, directors: null });
  });
});
