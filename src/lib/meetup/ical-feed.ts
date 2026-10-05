// Reads Meetup's iCal feed, the fallback when the events page fails. It holds the next 10 events only,
// with no venue, RSVP counts or images (plan §4). DTSTART is the meetup time, never the film start.
import { zonedTimeToUtcIso } from '../time';
import {
  latestStart,
  MEETUP_EVENT_URL,
  MeetupFormatError,
  type MeetupEvent,
  type MeetupProblem,
  type ParsedEvents,
} from './event';

export const ICAL_FEED_URL = 'https://www.meetup.com/amsterdam-film-group/events/ical/';

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

// NAME;PARAM=value;PARAM="quoted:value":VALUE (RFC 5545 §3.1)
const PROPERTY = /^([A-Za-z0-9-]+)((?:;[A-Za-z0-9-]+=(?:"[^"]*"|[^";:]*))*):(.*)$/;
const PARAM = /;([A-Za-z0-9-]+)=("[^"]*"|[^";:]*)/g;
const DATE_TIME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/;
const UID = /^event_(\d+)@meetup\.com$/;

/** Throws a MeetupFormatError when the text isn't a calendar. */
export function parseIcalFeed(text: string): ParsedEvents {
  // A line break followed by a space or tab continues the line. Meetup folds between characters,
  // never inside one (checked 1 October 2026), so unfolding the decoded text is safe.
  const lines = text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n');
  if (lines[0] !== 'BEGIN:VCALENDAR') throw new MeetupFormatError('not an iCal calendar');

  const events: MeetupEvent[] = [];
  const problems: MeetupProblem[] = [];
  let calendarName: string | null = null;
  let current: Map<string, Property> | null = null;
  let nested = 0; // components inside an event, such as an alarm, whose properties aren't the event's

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = new Map();
    } else if (line === 'END:VEVENT') {
      const event = current && toEvent(current, calendarName, problems);
      if (event) events.push(event);
      current = null;
    } else if (current && line.startsWith('BEGIN:')) {
      nested++;
    } else if (current && nested > 0) {
      if (line.startsWith('END:')) nested--;
    } else {
      const property = parseProperty(line);
      if (!property) continue;
      if (current) {
        if (!current.has(property.name)) current.set(property.name, property);
      } else if (property.name === 'X-WR-CALNAME' || property.name === 'NAME') {
        calendarName ??= unescapeText(property.value);
      }
    }
  }
  // The feed stops after 10 events, so a later event may simply not be in it.
  return { events, coversUntil: latestStart(events), problems };
}

function toEvent(props: Map<string, Property>, calendarName: string | null, problems: MeetupProblem[]): MeetupEvent | null {
  const uid = props.get('UID')?.value.trim() ?? '';
  const id = UID.exec(uid)?.[1];
  if (id === undefined) {
    problems.push({ skipped: true, message: `iCal event with an unknown UID skipped: ${uid}` });
    return null;
  }
  const title = unescapeText(props.get('SUMMARY')?.value ?? '').trim();
  const url = props.get('URL')?.value.trim() ?? '';
  const startsAt = dateTime(props.get('DTSTART'));
  const unreadable = [!title && 'SUMMARY', !MEETUP_EVENT_URL.test(url) && 'URL', !startsAt && 'DTSTART'].filter(
    (name): name is string => typeof name === 'string',
  );
  if (!startsAt || unreadable.length > 0) {
    problems.push({ eventId: id, skipped: true, message: `iCal event not readable: ${unreadable.join(', ')}` });
    return null;
  }

  const end = props.get('DTEND');
  const endsAt = end ? dateTime(end) : null;
  if (end && !endsAt) problems.push({ eventId: id, message: 'DTEND not readable; left out' });

  let description = unescapeText(props.get('DESCRIPTION')?.value ?? '');
  // Meetup puts the group's name on a line of its own above the description; the events page doesn't.
  if (calendarName && description.startsWith(`${calendarName}\n`)) description = description.slice(calendarName.length + 1);

  return {
    id,
    title,
    url,
    startsAt,
    endsAt,
    description,
    cancelled: props.get('STATUS')?.value.trim().toUpperCase() === 'CANCELLED',
  };
}

function parseProperty(line: string): Property | null {
  const match = PROPERTY.exec(line);
  if (!match) return null;
  const params: Record<string, string> = {};
  for (const [, key = '', value = ''] of (match[2] ?? '').matchAll(PARAM)) {
    params[key.toUpperCase()] = value.replace(/^"(.*)"$/, '$1');
  }
  return { name: (match[1] ?? '').toUpperCase(), params, value: match[3] ?? '' };
}

/** A DATE-TIME as a UTC ISO string, or null. A floating time (no Z, no TZID) names no instant, so it's null too. */
function dateTime(property: Property | undefined): string | null {
  const match = property && DATE_TIME.exec(property.value.trim());
  if (!match) return null;
  const local = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6]),
  };
  if (match[7] === 'Z') {
    return new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second)).toISOString();
  }
  const timeZone = property.params.TZID;
  if (!timeZone) return null;
  try {
    return zonedTimeToUtcIso(local, timeZone);
  } catch {
    return null; // an unknown time zone
  }
}

/** TEXT values escape newlines, commas, semicolons and backslashes (RFC 5545 §3.3.11). */
function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}
