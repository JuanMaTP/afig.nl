import { describe, expect, it } from 'vitest';
import type { AgendaEvent } from '../src/lib/agenda';
import { calendarFeed, eventCalendar, googleCalendarLink, subscribeLinks } from '../src/lib/calendar';

const amores: AgendaEvent = {
  id: '316526374',
  title: 'Amores Perros',
  url: 'https://www.meetup.com/amsterdam-film-group/events/316526374/',
  startsAt: '2026-10-11T16:30:00.000Z',
  endsAt: '2026-10-11T20:30:00.000Z',
  filmStartsAt: '2026-10-11T17:30:00.000Z',
  language: 'Spanish · English subtitles',
  format: '4K Restoration',
  auditorium: 'Cinema 3',
  ticketsUrl: 'https://kaarten.eyefilm.nl/eye/en/show/1',
  cancelled: false,
  venue: { name: 'Eye Filmmuseum', address: 'IJpromenade 1', city: 'Amsterdam' },
  going: 13,
  rsvpLimit: 20,
  coverImageUrl: null,
};
const now = new Date('2026-10-02T10:00:00.000Z');

/** The feed's lines with folding undone. */
const unfolded = (feed: string) => feed.replace(/\r\n /g, '').split('\r\n');

describe('calendarFeed', () => {
  it('writes one entry per event, with the film start and the language', () => {
    const lines = unfolded(calendarFeed([amores], now));
    expect(lines).toContain('UID:meetup-316526374@afig.nl');
    expect(lines).toContain('DTSTAMP:20261002T100000Z');
    expect(lines).toContain('DTSTART:20261011T163000Z');
    expect(lines).toContain('DTEND:20261011T203000Z');
    expect(lines).toContain('SUMMARY:Amores Perros');
    expect(lines).toContain(
      'DESCRIPTION:Meet 18:30 · Film starts 19:30\\nSpanish · English subtitles\\nEye Filmmuseum · Cinema 3\\n' +
        'Tickets: https://kaarten.eyefilm.nl/eye/en/show/1\\nRSVP on Meetup: https://www.meetup.com/amsterdam-film-group/events/316526374/',
    );
    expect(lines).toContain('LOCATION:Eye Filmmuseum\\, IJpromenade 1\\, Amsterdam');
    expect(lines).toContain('STATUS:CONFIRMED');
  });

  it('marks a cancelled event, without its ticket link', () => {
    const lines = unfolded(calendarFeed([{ ...amores, cancelled: true }], now));
    expect(lines).toContain('SUMMARY:Cancelled: Amores Perros');
    expect(lines).toContain('STATUS:CANCELLED');
    expect(lines.join('\n')).not.toContain('kaarten.eyefilm.nl');
  });

  it('leaves out what is unknown', () => {
    const bare = { ...amores, endsAt: null, filmStartsAt: null, language: null, auditorium: null, ticketsUrl: null, venue: null };
    const lines = unfolded(calendarFeed([bare], now));
    expect(lines.some((l) => l.startsWith('DTEND') || l.startsWith('LOCATION'))).toBe(false);
    expect(lines).toContain('DESCRIPTION:Meet 18:30\\nRSVP on Meetup: https://www.meetup.com/amsterdam-film-group/events/316526374/');
  });

  it('escapes text', () => {
    const lines = unfolded(calendarFeed([{ ...amores, title: 'Love; Death, and \\ Robots' }], now));
    expect(lines).toContain('SUMMARY:Love\\; Death\\, and \\\\ Robots');
  });

  it('ends every line with CRLF and folds at 75 octets without splitting a character', () => {
    const feed = calendarFeed([{ ...amores, title: `${'Ü'.repeat(60)} 🎉🎉` }], now);
    expect(feed.endsWith('\r\n')).toBe(true);
    expect(feed.replace(/\r\n/g, '')).not.toContain('\n');
    for (const line of feed.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(unfolded(feed)).toContain(`SUMMARY:${'Ü'.repeat(60)} 🎉🎉`);
  });

  it('is a calendar even with no events', () => {
    const lines = unfolded(calendarFeed([], now));
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('END:VCALENDAR');
    expect(lines).not.toContain('BEGIN:VEVENT');
  });
});

describe('eventCalendar', () => {
  it("holds the one event, with the feed's entry and UID", () => {
    const single = unfolded(eventCalendar(amores, now));
    const feed = unfolded(calendarFeed([amores], now));
    expect(single.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    const entryOf = (lines: string[]) => lines.slice(lines.indexOf('BEGIN:VEVENT'), lines.indexOf('END:VEVENT') + 1);
    expect(entryOf(single)).toEqual(entryOf(feed));
    expect(single).toContain('UID:meetup-316526374@afig.nl');
    // A file to import, not a subscription: no name or refresh interval of its own.
    expect(single.some((l) => l.startsWith('X-WR-CALNAME') || l.startsWith('REFRESH-INTERVAL'))).toBe(false);
  });
});

describe('googleCalendarLink', () => {
  it("fills in Google Calendar's new-event form", () => {
    const link = new URL(googleCalendarLink(amores));
    expect(link.origin + link.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(Object.fromEntries(link.searchParams)).toEqual({
      action: 'TEMPLATE',
      text: 'Amores Perros',
      dates: '20261011T163000Z/20261011T203000Z',
      details:
        'Meet 18:30 · Film starts 19:30\nSpanish · English subtitles\nEye Filmmuseum · Cinema 3\n' +
        'Tickets: https://kaarten.eyefilm.nl/eye/en/show/1\nRSVP on Meetup: https://www.meetup.com/amsterdam-film-group/events/316526374/',
      location: 'Eye Filmmuseum, IJpromenade 1, Amsterdam',
    });
  });

  it('leaves out what is unknown, and never makes up an end', () => {
    const link = new URL(googleCalendarLink({ ...amores, endsAt: null, venue: null }));
    expect(link.searchParams.get('dates')).toBe('20261011T163000Z/20261011T163000Z');
    expect(link.searchParams.has('location')).toBe(false);
  });
});

describe('subscribeLinks', () => {
  it('offers webcal for Apple, a Google link and the plain address', () => {
    expect(subscribeLinks(new URL('https://afig.nl/calendar.ics'))).toEqual({
      webcal: 'webcal://afig.nl/calendar.ics',
      google: 'https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fafig.nl%2Fcalendar.ics',
      https: 'https://afig.nl/calendar.ics',
    });
  });
});
