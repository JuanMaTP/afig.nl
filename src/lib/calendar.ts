// The site's calendar feed, /calendar.ics (plan §5.1): every upcoming event, with the film start and the
// language in each entry. Meetup's own feed holds only the next 10 events and only the meetup time.
// Also one event on its own, for a card's "Add to calendar": the same entry, as a file or a Google link.
// RFC 5545: CRLF line endings, text escaped, lines folded at 75 octets without splitting a character.
import type { AgendaEvent } from './agenda';
import { formatTime } from './format';

export const CALENDAR_NAME = 'AFiG: Amsterdam Film Group';

/** How far back the feed keeps events, so the screenings a member went to stay in a subscribed calendar. */
export const CALENDAR_KEEPS_DAYS = 30;

/** How often calendar apps are asked to check for changes. */
const REFRESH = 'PT6H';

const CALENDAR_START = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AFiG//afig.nl//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];

export function calendarFeed(agenda: AgendaEvent[], now: Date): string {
  return calendar([
    ...CALENDAR_START,
    `X-WR-CALNAME:${escapeText(CALENDAR_NAME)}`,
    `X-WR-CALDESC:${escapeText('Every AFiG event, with the film start and the language. RSVP on Meetup.')}`,
    'X-WR-TIMEZONE:Europe/Amsterdam',
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH}`,
    `X-PUBLISHED-TTL:${REFRESH}`,
    ...agenda.flatMap((event) => entry(event, now)),
    'END:VCALENDAR',
  ]);
}

/**
 * One event on its own, for "Add to calendar" (/events/<id>.ics). It has the feed's UID, so a calendar
 * that also subscribes to the feed sees the same event, not a second one.
 */
export function eventCalendar(event: AgendaEvent, now: Date): string {
  return calendar([...CALENDAR_START, ...entry(event, now), 'END:VCALENDAR']);
}

/** The event in Google Calendar's "new event" form, filled in: for phones without an app that opens .ics files. */
export function googleCalendarLink(event: AgendaEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    // An event without an end gets none here either: it starts and ends at the meetup time.
    dates: `${icalTime(event.startsAt)}/${icalTime(event.endsAt ?? event.startsAt)}`,
    details: description(event),
  });
  const where = location(event);
  if (where) params.set('location', where);
  return `https://calendar.google.com/calendar/render?${params}`;
}

function calendar(lines: string[]): string {
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** What an entry says: both times, the language, the place and the links. */
function description(event: AgendaEvent): string {
  const times = [`Meet ${formatTime(event.startsAt)}`, event.filmStartsAt && `Film starts ${formatTime(event.filmStartsAt)}`];
  const place = [event.venue?.name, event.auditorium];
  return [
    event.cancelled && 'Cancelled.',
    times.filter(Boolean).join(' · '),
    event.language,
    place.filter(Boolean).join(' · '),
    !event.cancelled && event.ticketsUrl && `Tickets: ${event.ticketsUrl}`,
    `${event.cancelled ? 'On Meetup' : 'RSVP on Meetup'}: ${event.url}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function location(event: AgendaEvent): string {
  return [event.venue?.name, event.venue?.address, event.venue?.city].filter(Boolean).join(', ');
}

function entry(event: AgendaEvent, now: Date): string[] {
  const where = location(event);
  return [
    'BEGIN:VEVENT',
    `UID:meetup-${event.id}@afig.nl`,
    `DTSTAMP:${icalTime(now.toISOString())}`,
    `DTSTART:${icalTime(event.startsAt)}`,
    ...(event.endsAt ? [`DTEND:${icalTime(event.endsAt)}`] : []),
    `SUMMARY:${escapeText(event.cancelled ? `Cancelled: ${event.title}` : event.title)}`,
    `DESCRIPTION:${escapeText(description(event))}`,
    ...(where ? [`LOCATION:${escapeText(where)}`] : []),
    `URL:${event.url}`,
    `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
  ];
}

/** "2026-10-11T16:30:00.000Z" → "20261011T163000Z". */
function icalTime(iso: string): string {
  return iso.replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Lines of at most 75 octets; each continuation starts with a space. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (octets + size > 75) {
      parts.push(current);
      current = ' ';
      octets = 1;
    }
    current += character;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n');
}

export interface SubscribeLinks {
  /** Apple Calendar, and most other apps: a webcal:// link opens a subscription. */
  webcal: string;
  google: string;
  /** The plain address, for apps that ask for one. */
  https: string;
}

export function subscribeLinks(feedUrl: URL): SubscribeLinks {
  const webcal = `webcal://${feedUrl.host}${feedUrl.pathname}`;
  return {
    webcal,
    google: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`,
    https: feedUrl.href,
  };
}
