// The titles are the live events of 1 and 2 October 2026.
import { describe, expect, it } from 'vitest';
import { describeLanguage, readTitle } from '../../src/lib/details/title';

describe('readTitle', () => {
  it.each([
    ['A River Runs Through It (English without Subtitles)', 'A River Runs Through It', 'English · no subtitles', null],
    ['Being John Malkovich (English – No Subtitles)', 'Being John Malkovich', 'English · no subtitles', null],
    ['Perfect Days (Japanese w/ English Subtitles)', 'Perfect Days', 'Japanese · English subtitles', null],
    ['The Matrix (English with Dutch Subtitles)', 'The Matrix', 'English · Dutch subtitles', null],
    ['The Social Reckoning (English with subtitles in dutch)', 'The Social Reckoning', 'English · Dutch subtitles', null],
    [
      'The Beloved - Premiere + Q&A with Director (Spanish w/ English subs)',
      'The Beloved - Premiere + Q&A with Director',
      'Spanish · English subtitles',
      null,
    ],
    [
      'My Father’s Shadow (Nigerian Pidgin [Naija], Yoruba, and English w/English subs)',
      'My Father’s Shadow',
      'Nigerian Pidgin [Naija], Yoruba, and English · English subtitles',
      null,
    ],
    ['Amores Perros (4K Restoration) (Spanish w/ English Subtitles)', 'Amores Perros', 'Spanish · English subtitles', '4K Restoration'],
    ['Dune: Part Three (IMAX 70mm) (Field Trip: Brussels)', 'Dune: Part Three (Field Trip: Brussels)', null, 'IMAX 70mm'],
    // Curly braces around the format, with the language bracket inside (20 September 2026).
    [
      'In the Mood for Love {4K Restoration (Cantonese w/ English Subtitles)}',
      'In the Mood for Love',
      'Cantonese · English subtitles',
      '4K Restoration',
    ],
  ])('%s', (full, title, language, format) => {
    expect(readTitle(full)).toEqual({ title, language, format });
  });

  it('keeps the year, which tells a remake from the original', () => {
    expect(readTitle('5 Centimeters Per Second (2025) (Japanese w/ English Subtitles)').title).toBe('5 Centimeters Per Second (2025)');
    expect(readTitle('12 Angry Men (1957) (English w/ English Subtitles)')).toEqual({
      title: '12 Angry Men (1957)',
      language: 'English · English subtitles',
      format: null,
    });
  });

  it('closes the gap a bracket leaves in the middle', () => {
    expect(readTitle('Digger (English w/ Dutch Subtitles) + 2nd Anniversary Celebration 🎉')).toEqual({
      title: 'Digger + 2nd Anniversary Celebration 🎉',
      language: 'English · Dutch subtitles',
      format: null,
    });
  });

  it('leaves a title without a language bracket as it is', () => {
    expect(readTitle('Metropolis (1927) - with Live Orchestra')).toEqual({
      title: 'Metropolis (1927) - with Live Orchestra',
      language: null,
      format: null,
    });
  });

  it('reads a typo hosts made, "subititles"', () => {
    expect(readTitle('The Odyssey - 70 mm (English without subititles)')).toEqual({
      title: 'The Odyssey - 70 mm',
      language: 'English · no subtitles',
      format: null,
    });
  });

  it('takes no language when two brackets mention subtitles', () => {
    const full = 'Double Bill (French w/ English subs) (German w/ English subs)';
    expect(readTitle(full)).toEqual({ title: full, language: null, format: null });
  });

  // Avengers: Endgame Encore, 26 September 2026: the seats showed as its language.
  it('leaves the host’s seats out of the language and the title', () => {
    expect(readTitle('Avengers: Endgame Encore (IMAX English, no subtitles, Row 14 seats 16 to 20)')).toEqual({
      title: 'Avengers: Endgame Encore',
      language: 'IMAX English, no subtitles',
      format: null,
    });
    expect(readTitle('Perfect Days (Japanese w/ English Subtitles; Row 3, Seat 5)').language).toBe('Japanese · English subtitles');
    expect(readTitle('Perfect Days (Row 3, Seat 5) (Japanese w/ English Subtitles)')).toEqual({
      title: 'Perfect Days',
      language: 'Japanese · English subtitles',
      format: null,
    });
  });

  it('keeps the full title when nothing but brackets is left', () => {
    expect(readTitle('(English w/ Dutch subs)')).toEqual({ title: '(English w/ Dutch subs)', language: null, format: null });
  });
});

describe('describeLanguage', () => {
  it('reads the `Language:` lines hosts write', () => {
    expect(describeLanguage('Spanish with English subtitles')).toBe('Spanish · English subtitles');
    expect(describeLanguage('English with dutch subtitles')).toBe('English · Dutch subtitles');
    expect(describeLanguage('English (No subtitles)')).toBe('English · no subtitles');
    expect(describeLanguage('English, Dutch subtitles')).toBe('English · Dutch subtitles');
  });

  it('reads the variants seen in the archive', () => {
    expect(describeLanguage('English w/ no subtitles')).toBe('English · no subtitles');
    expect(describeLanguage('Eng w/ Nl subtitles')).toBe('English · Dutch subtitles');
    expect(describeLanguage('Arabic w/ Eng subtitles')).toBe('Arabic · English subtitles');
  });

  it('shows a bracket as written when a year or a format is mixed into the language', () => {
    expect(describeLanguage('IMAX Pathe English w/ Dutch subtitles')).toBe('IMAX Pathe English w/ Dutch subtitles');
    expect(describeLanguage('70mm version w/ Dutch subtitles')).toBe('70mm version w/ Dutch subtitles');
    expect(describeLanguage('2025 - French and English w/ English subtitles')).toBe('2025 - French and English w/ English subtitles');
  });

  it("returns a phrasing it doesn't know as the host wrote it", () => {
    expect(describeLanguage('English (subtitles will be confirmed when the listing is published)')).toBe(
      'English (subtitles will be confirmed when the listing is published)',
    );
    expect(describeLanguage('English with subtitles')).toBe('English with subtitles');
    expect(describeLanguage('No dialogue')).toBe('No dialogue');
  });
});
