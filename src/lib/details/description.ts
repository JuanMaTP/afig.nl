// Reads the screening details hosts write in an event description (plan §4, Descriptions vary by host).
// Hosts were asked for four labeled lines (`Film starts:` · `Tickets:` · `Language:` · `Auditorium:`),
// but the formats vary: bold Markdown, a label inside a link, the film start inside a sentence.
// Labels count only at the start of a line, a time only as HH:MM, and a field that reads two ways
// is left out: never a guessed detail (CLAUDE.md).
import { normaliseLanguage } from './title';

export interface DescriptionDetails {
  /** The film start as written. Check it against the event's times before showing it. */
  filmStarts: { hour: number; minute: number } | null;
  /** As written. It may name the cinema instead of the room ("Theater: LAB111"): check it against the venue. */
  auditorium: string | null;
  ticketsUrl: string | null;
  /** The `Language:` line as written. The title's bracket comes first (plan §5.1). */
  language: string | null;
  /**
   * From one host's template sentence, "The film is in Japanese, with English subtitles.", already
   * normalised ("Japanese · English subtitles"); null unless it reads cleanly. After the `Language:` line.
   */
  languageSentence: string | null;
}

// "Film starts: 19:30", "Film start: 19:30", "The film starts at 18:45", "The film starts at 21.00",
// "Concert / film starts: 19:30".
const FILM_START = /\bfilm (?:starts?|start time|begins)\b\s*:?\s*(?:at\s+)?(\d{1,2})[:.](\d{2})(?!\d)/gi;
// "The film is in English, with Dutch subtitles." Up to the first mention of subtitles, within the sentence.
const LANGUAGE_SENTENCE = /\bThe film is in ([^.\n]{2,80}?\bsub(?:i?titles?|s)\b)/gi;
const LABEL_LINE = /^(?:[-•]\s*)?([A-Za-z][A-Za-z &/]*?)\s*:\s*(.*)$/;
// "[Info and tickets](https://…)", "[Tickets](https://…)": the label is the link text.
const LINK_LABEL_LINE = /^\[([A-Za-z][A-Za-z &]*)\]\((https?:\/\/[^\s)]+)\)/;
const MARKDOWN_LINK = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/;
/** A line that is just a link, bare or in Markdown. */
const LINK_ONLY_LINE = /^(?:\[[^\]]*\]\()?https?:\/\//;
const BARE_URL = /https?:\/\/[^\s)\]>]+/;

const AUDITORIUM_LABELS = new Set(['auditorium', 'theater', 'theatre', 'zaal']);
const TICKETS_LABELS = new Set(['tickets', 'ticket']);
const INFO_AND_TICKETS_LABELS = new Set(['info and tickets', 'info & tickets', 'tickets and info', 'tickets & info']);
const LANGUAGE_LABELS = new Set(['language', 'languages']);

/** Longer than this, an auditorium value is a sentence, not a room. */
const MAX_AUDITORIUM_LENGTH = 40;

export function readDescription(description: string): DescriptionDetails {
  const lines = description.split(/\r?\n/).map(plainLine);

  const auditoriums: string[] = [];
  const tickets: string[] = [];
  const infoAndTickets: string[] = [];
  const languages: string[] = [];
  lines.forEach((line, i) => {
    const linked = LINK_LABEL_LINE.exec(line);
    if (linked) {
      const label = linked[1]!.toLowerCase().trim();
      const url = cleanUrl(linked[2]!);
      if (url && TICKETS_LABELS.has(label)) tickets.push(url);
      if (url && INFO_AND_TICKETS_LABELS.has(label)) infoAndTickets.push(url);
      return;
    }
    const labeled = LABEL_LINE.exec(line);
    if (!labeled) return;
    const label = labeled[1]!.toLowerCase().trim();
    const value = labeled[2]!.trim();
    if (AUDITORIUM_LABELS.has(label)) {
      const room = linkText(value).replace(/[.;]+$/, '').trim();
      if (room !== '' && room.length <= MAX_AUDITORIUM_LENGTH && !BARE_URL.test(room)) auditoriums.push(room);
    } else if (TICKETS_LABELS.has(label) || INFO_AND_TICKETS_LABELS.has(label)) {
      // "**Tickets:**" with the link on the next line; not when that line is another label's.
      const next = value === '' ? lines.slice(i + 1).find((l) => l.trim() !== '') : undefined;
      const url = firstUrl(value) ?? (next && LINK_ONLY_LINE.test(next) ? firstUrl(next) : null);
      if (url) (TICKETS_LABELS.has(label) ? tickets : infoAndTickets).push(url);
    } else if (LANGUAGE_LABELS.has(label)) {
      const language = linkText(value).trim();
      if (language !== '') languages.push(language);
    }
  });

  // A sentence counts only when it reads cleanly: anything else is left out, never shown as prose.
  const sentences = [...lines.join('\n').matchAll(LANGUAGE_SENTENCE)].map((m) => normaliseLanguage(m[1]!));

  const starts = [...lines.join('\n').matchAll(FILM_START)]
    .map((m) => ({ hour: Number(m[1]), minute: Number(m[2]) }))
    .filter(({ hour, minute }) => hour <= 23 && minute <= 59);

  return {
    filmStarts: onlyOne(starts, (t) => `${t.hour}:${t.minute}`),
    auditorium: onlyOne(auditoriums, (a) => a.toLowerCase()),
    // A plain `Tickets:` link beats a combined `Info and tickets:` one.
    ticketsUrl: onlyOne(tickets.length > 0 ? tickets : infoAndTickets, (u) => u),
    language: onlyOne(languages, (l) => l.toLowerCase()),
    languageSentence: sentences.includes(null) ? null : onlyOne(sentences as string[], (l) => l.toLowerCase()),
  };
}

/** A line without Markdown bold or escapes: "**Directed** by:" → "Directed by:", "2\." → "2.". */
export function plainLine(line: string): string {
  return line
    .replace(/\*\*|__/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!,:])/g, '$1')
    .trim();
}

/** The value when every reading agrees, null when there is none or they differ. */
function onlyOne<T>(values: T[], key: (value: T) => string): T | null {
  const distinct = new Set(values.map(key));
  return distinct.size === 1 ? values[0]! : null;
}

/** "[LAB111 – Perfect Days](https://…)" → its URL; else the first bare URL. */
function firstUrl(text: string): string | null {
  const raw = MARKDOWN_LINK.exec(text)?.[2] ?? BARE_URL.exec(text)?.[0];
  return raw ? cleanUrl(raw) : null;
}

/** "[Cinema 3](https://…)" → "Cinema 3". */
function linkText(text: string): string {
  return text.replace(new RegExp(MARKDOWN_LINK.source, 'g'), '$1');
}

/** Only http(s) links, without tracking parameters (`utm_source=chatgpt.com` is in some descriptions). */
function cleanUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  for (const name of [...url.searchParams.keys()]) if (name.startsWith('utm_')) url.searchParams.delete(name);
  return url.href;
}
