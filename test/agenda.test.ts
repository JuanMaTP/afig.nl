import { describe, expect, it } from 'vitest';
import { agendaEvent, groupByDay } from '../src/lib/agenda';
import { eventAt, storedEvent as stored } from './events';

describe('agendaEvent', () => {
  it('reads the details from the title and the description', () => {
    expect(agendaEvent(stored())).toMatchObject({
      title: 'Amores Perros',
      language: 'Spanish · English subtitles',
      format: '4K Restoration',
      filmStartsAt: '2026-10-11T17:30:00.000Z',
      auditorium: 'Cinema 3',
      ticketsUrl: 'https://kaarten.eyefilm.nl/eye/en/show/1',
      venue: { name: 'Eye Filmmuseum', address: 'IJpromenade 1', city: 'Amsterdam' },
    });
  });

  it('puts the film start on the event day in winter time too', () => {
    const winter = stored({ startsAt: '2026-11-11T17:00:00.000Z', endsAt: '2026-11-11T20:00:00.000Z', description: 'Film starts: 18:45' });
    expect(agendaEvent(winter).filmStartsAt).toBe('2026-11-11T17:45:00.000Z');
  });

  it('leaves out a film start before the meetup or after the end', () => {
    expect(agendaEvent(stored({ description: 'Film starts: 18:00' })).filmStartsAt).toBeNull();
    expect(agendaEvent(stored({ description: 'Film starts: 23:00' })).filmStartsAt).toBeNull();
    expect(agendaEvent(stored({ description: 'Film starts: 18:30' })).filmStartsAt).toBe('2026-10-11T16:30:00.000Z');
  });

  it('drops an auditorium that names the cinema itself', () => {
    const lab = { venueName: 'LAB111', meetupVenueName: 'LAB111' };
    expect(agendaEvent(stored({ ...lab, description: '**Theater**: LAB111' })).auditorium).toBeNull();
    expect(agendaEvent(stored({ ...lab, description: '**Auditorium:** LAB 4' })).auditorium).toBe('LAB 4');
    const uitkijk = { venueName: 'De Uitkijk', meetupVenueName: 'Filmtheater De Nw. Uitkijk BV' };
    expect(agendaEvent(stored({ ...uitkijk, description: '**Theater**: De Uitkijk' })).auditorium).toBeNull();
  });

  it('keeps a short room name inside a venue name', () => {
    expect(agendaEvent(stored({ venueName: 'LAB111', description: 'Auditorium: 1' })).auditorium).toBe('1');
  });

  it('takes the language from the description when the title has no bracket', () => {
    const event = stored({ title: 'Amores Perros', description: '**Language:** Spanish with English subtitles' });
    expect(agendaEvent(event).language).toBe('Spanish · English subtitles');
  });

  it("falls back to a host's template sentence, after the Language: line", () => {
    const sentence = 'The film is in Japanese, with English subtitles.';
    expect(agendaEvent(stored({ title: 'Ran', description: sentence })).language).toBe('Japanese · English subtitles');
    expect(agendaEvent(stored({ title: 'Ran', description: `Language: Japanese\n${sentence}` })).language).toBe('Japanese');
  });

  it("prefers the title's bracket to the Language: line", () => {
    expect(agendaEvent(stored({ description: 'Language: Spanish' })).language).toBe('Spanish · English subtitles');
  });

  it("shows Meetup's venue name when the venue has no alias", () => {
    const event = stored({ venueName: null, venueAddress: null, venueCity: null, meetupVenueName: 'Cinemercator' });
    expect(agendaEvent(event).venue).toEqual({ name: 'Cinemercator', address: null, city: null });
  });
});

describe('groupByDay', () => {
  const at = (id: string, startsAt: string) => eventAt(id, startsAt);
  const now = new Date('2026-10-02T10:00:00.000Z'); // Friday 2 October, 12:00 in Amsterdam

  it('groups by Amsterdam day, naming today and tomorrow', () => {
    const days = groupByDay(
      [
        at('a', '2026-10-02T16:30:00.000Z'),
        at('b', '2026-10-02T18:00:00.000Z'),
        at('c', '2026-10-03T16:00:00.000Z'),
        at('d', '2026-10-04T10:45:00.000Z'),
      ],
      now,
    );
    expect(days.map((d) => [d.key, d.label, d.date, d.events.map((e) => e.id)])).toEqual([
      ['2026-10-02', 'Today', 'Fri 2 Oct', ['a', 'b']],
      ['2026-10-03', 'Tomorrow', 'Sat 3 Oct', ['c']],
      ['2026-10-04', 'Sun 4 Oct', null, ['d']],
    ]);
  });

  it('puts a late UTC time on the next Amsterdam day', () => {
    expect(groupByDay([at('late', '2026-10-02T22:30:00.000Z')], now)[0]).toMatchObject({ key: '2026-10-03', label: 'Tomorrow' });
  });

  it('crosses a month', () => {
    const endOfMonth = new Date('2026-10-31T12:00:00.000Z');
    expect(groupByDay([at('nov', '2026-11-01T17:00:00.000Z')], endOfMonth)[0]?.label).toBe('Tomorrow');
  });
});
