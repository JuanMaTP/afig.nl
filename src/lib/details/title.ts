// Reads a Meetup event title (plan §4, Descriptions vary by host). Hosts put the language in a bracket,
// "(Japanese w/ English Subtitles)", and sometimes the format, "(4K Restoration)". The agenda shows
// them apart from the title. Whatever can't be read with confidence stays as the host wrote it.
// Not for film matching: that uses `EK` from AFG-Matcher.md (CLAUDE.md, Film matching).

export interface TitleParts {
  /** The title without its language and format brackets; the full title when nothing could be taken out. */
  title: string;
  /** The language and subtitles, from the bracket that mentions subtitles. */
  language: string | null;
  /** The presentation format, such as "4K Restoration" or "IMAX 70mm". */
  format: string | null;
}

const BRACKET = /\(([^()]*)\)/g;
// "subititles" too: a host's typo, twice in the archive (2 October 2026).
const SUBTITLES = /\bsub(?:i?titles?|titled|s)?\b/i;
const FORMAT = /\b(?:4K|35 ?mm|70 ?mm|IMAX|restored|restoration|remastered)\b/i;

export function readTitle(full: string): TitleParts {
  const brackets = [...unwrapBraces(full).matchAll(BRACKET)];
  const seatBrackets = brackets.filter((b) => SEAT.test(b[1]!) && withoutSeats(b[1]!) === '');
  const languageBrackets = brackets.filter((b) => SUBTITLES.test(b[1]!));
  const formatBrackets = brackets.filter((b) => !SUBTITLES.test(b[1]!) && FORMAT.test(b[1]!));
  // Two brackets about subtitles would mean choosing one: leave both in the title instead.
  const language = languageBrackets.length === 1 ? languageBrackets[0]! : null;

  let title = unwrapBraces(full);
  for (const bracket of [...(language ? [language] : []), ...formatBrackets, ...seatBrackets]) title = title.replace(bracket[0], ' ');
  title = title
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—+:,]\s*$/, '')
    .trim();
  if (title === '') return { title: full.trim(), language: null, format: null };

  return {
    title,
    language: language ? describeLanguage(withoutSeats(language[1]!)) : null,
    format: formatBrackets.map((b) => b[1]!.trim()).join(' · ') || null,
  };
}

// The host's seats, which some put in the title: "(IMAX English, no subtitles, Row 14 seats 16 to 20)". They
// aren't the language or the title; the description's seat line says where the host sits.
const SEAT = /\b(?:row|rij|seats?|stoel(?:en)?)\b/i;

/** A bracket's text without the parts, between commas or semicolons, that are about seats. */
function withoutSeats(text: string): string {
  return text
    .split(/\s*[,;]\s*/)
    .filter((part) => part.trim() !== '' && !SEAT.test(part))
    .join(', ');
}

/**
 * A host sometimes wraps the format and the language in curly braces, the language in its own bracket inside:
 * "In the Mood for Love {4K Restoration (Cantonese w/ English Subtitles)}". Each brace group becomes plain
 * brackets, "(4K Restoration) (Cantonese w/ English Subtitles)", so each part is read as any other bracket.
 */
function unwrapBraces(full: string): string {
  return full.replace(/\{([^{}]*)\}/g, (_, inner: string) => {
    const nested = [...inner.matchAll(BRACKET)].map((b) => b[0]);
    const rest = inner.replace(BRACKET, ' ').replace(/\s+/g, ' ').trim();
    return [rest && `(${rest})`, ...nested].filter(Boolean).join(' ');
  });
}

// The spoken language, then the subtitles: "English without Subtitles", "English – No Subtitles",
// "English (No subtitles)", "English, with no subtitles", "English w/ no subtitles",
// "Japanese w/ English Subtitles", "English w/English subs", "English with subtitles in dutch",
// "English, Dutch subtitles".
const SUBS = String.raw`sub(?:i?titles?|s)`;
const NO_SUBTITLES = new RegExp(String.raw`^(.+?)\s*[–—-]?\s*\(?\s*(?:(?:with|w\/)\s*no|without|no)\s+${SUBS}\s*\)?$`, 'iu');
const SUBTITLES_IN = new RegExp(String.raw`^(.+?)\s+(?:w\/|with)\s*${SUBS}\s+in\s+(\p{L}+)$`, 'iu');
const WITH_SUBTITLES = new RegExp(String.raw`^(.+?)\s+(?:w\/|with)\s*(\p{L}+)\s+${SUBS}$`, 'iu');
const COMMA_SUBTITLES = new RegExp(String.raw`^(.+?)\s*[,–—-]\s*(\p{L}+)\s+${SUBS}$`, 'iu');

/**
 * "Japanese w/ English Subtitles" → "Japanese · English subtitles"; "English without Subtitles" →
 * "English · no subtitles". A phrasing it doesn't know comes back as the host wrote it.
 */
export function describeLanguage(text: string): string {
  return normaliseLanguage(text) ?? text.replace(/\s+/g, ' ').trim();
}

/** As `describeLanguage`, but null for a phrasing it doesn't know. */
export function normaliseLanguage(text: string): string | null {
  const written = text.replace(/\s+/g, ' ').trim();
  const none = NO_SUBTITLES.exec(written);
  if (none) {
    const language = spokenPart(none[1]!);
    return language && `${language} · no subtitles`;
  }
  const subtitled = SUBTITLES_IN.exec(written) ?? WITH_SUBTITLES.exec(written) ?? COMMA_SUBTITLES.exec(written);
  const language = subtitled && spokenPart(subtitled[1]!);
  return subtitled && language ? `${language} · ${languageName(subtitled[2]!)} subtitles` : null;
}

// Abbreviations hosts use: "Eng · Nl subtitles" reads as English and Dutch.
const ABBREVIATIONS: Record<string, string> = { en: 'English', eng: 'English', nl: 'Dutch', ned: 'Dutch', fr: 'French' };

function languageName(word: string): string {
  return ABBREVIATIONS[word.toLowerCase()] ?? capitalise(word.toLowerCase());
}

/**
 * The spoken language, or null when the part before the subtitles doesn't look like one: a year or a
 * format in it ("IMAX Pathe English", "70mm version", "2025 - French") means the host mixed other
 * things in, so the bracket is shown as written instead.
 */
function spokenPart(part: string): string | null {
  const language = part.replace(/[\s,–—-]+$/, '').trim();
  if (language === '' || SUBTITLES.test(language) || /\d|\b(?:IMAX|3D)\b/i.test(language)) return null;
  return ABBREVIATIONS[language.toLowerCase()] ?? capitalise(language);
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
