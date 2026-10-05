// Events as D1 returns them, for the tests of what the agenda, the month view and the archive make of them.
import { type AgendaEvent, agendaEvent, type StoredEvent } from '../src/lib/agenda';

/** Amores Perros at Eye on 11 October 2026, as the ingest stores it, with any field changed. */
export function storedEvent(change: Partial<StoredEvent> = {}): StoredEvent {
  return {
    id: '316526374',
    title: 'Amores Perros (4K Restoration) (Spanish w/ English Subtitles)',
    url: 'https://www.meetup.com/amsterdam-film-group/events/316526374/',
    startsAt: '2026-10-11T16:30:00.000Z', // 18:30 in Amsterdam
    endsAt: '2026-10-11T20:30:00.000Z',
    description: '**Film starts:** 19:30\n**Auditorium:** Cinema 3\n**Tickets:** https://kaarten.eyefilm.nl/eye/en/show/1',
    cancelled: false,
    venueName: 'Eye Filmmuseum',
    venueAddress: 'IJpromenade 1',
    venueCity: 'Amsterdam',
    meetupVenueName: 'Eye Filmmuseum',
    going: 13,
    rsvpLimit: 20,
    coverImageUrl: null,
    ...change,
  };
}

/** A bare event titled by its id, at a given time: for grouping and counting. */
export function eventAt(id: string, startsAt: string, change: Partial<StoredEvent> = {}): AgendaEvent {
  return agendaEvent(
    storedEvent({
      id,
      title: id,
      url: `https://www.meetup.com/amsterdam-film-group/events/${id}/`,
      startsAt,
      endsAt: null,
      description: '',
      venueName: null,
      venueAddress: null,
      venueCity: null,
      meetupVenueName: null,
      going: null,
      rsvpLimit: null,
      ...change,
    }),
  );
}
