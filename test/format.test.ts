import { describe, expect, it } from 'vitest';
import {
  coverImageSources,
  formatAttendance,
  formatDay,
  formatMonth,
  formatRating,
  formatTime,
  thumbnailSources,
} from '../src/lib/format';

describe('formatDay and formatTime', () => {
  it('write Amsterdam time, in summer and in winter', () => {
    expect(formatDay('2026-10-01T16:10:00.000Z')).toBe('Thu 1 Oct');
    expect(formatTime('2026-10-01T16:10:00.000Z')).toBe('18:10');
    expect(formatTime('2026-11-11T17:00:00.000Z')).toBe('18:00');
  });

  it('put a late UTC time on the next Amsterdam day', () => {
    expect(formatDay('2026-10-01T22:30:00.000Z')).toBe('Fri 2 Oct');
    expect(formatTime('2026-10-01T22:30:00.000Z')).toBe('00:30');
  });
});

describe('formatMonth', () => {
  it('names the Amsterdam month', () => {
    expect(formatMonth('2026-10-11T16:30:00.000Z')).toBe('October 2026');
    expect(formatMonth('2026-09-30T22:30:00.000Z')).toBe('October 2026');
  });
});

describe('formatAttendance', () => {
  it('counts the places left under an RSVP limit', () => {
    expect(formatAttendance(13, 20)).toEqual({ text: '13 going · 7 places left', tone: 'open' });
    expect(formatAttendance(19, 20)).toEqual({ text: '19 going · 1 place left', tone: 'few' });
    expect(formatAttendance(20, 20)).toEqual({ text: '20 going · full', tone: 'full' });
    expect(formatAttendance(22, 20)).toEqual({ text: '22 going · full', tone: 'full' });
  });

  it('says so when only a few places are left', () => {
    expect(formatAttendance(16, 20)?.tone).toBe('open');
    expect(formatAttendance(17, 20)?.tone).toBe('few');
  });

  it('shows only the number going without a limit, and nothing when the count is unknown', () => {
    expect(formatAttendance(3, null)).toEqual({ text: '3 going', tone: 'open' });
    expect(formatAttendance(null, 20)).toBeNull();
  });
});

describe('coverImageSources', () => {
  it("offers Meetup's 600 px version beside the full one", () => {
    expect(coverImageSources('https://secure.meetupstatic.com/photos/event/2/4/highres_536100036.jpeg')).toEqual({
      src: 'https://secure.meetupstatic.com/photos/event/2/4/600_536100036.jpeg',
      srcset:
        'https://secure.meetupstatic.com/photos/event/2/4/600_536100036.jpeg 600w, https://secure.meetupstatic.com/photos/event/2/4/highres_536100036.jpeg 1920w',
    });
  });

  it('uses any other image as it is', () => {
    expect(coverImageSources('https://secure.meetupstatic.com/photos/event/other.png')).toEqual({
      src: 'https://secure.meetupstatic.com/photos/event/other.png',
    });
  });
});

describe('thumbnailSources', () => {
  it("offers Meetup's 180 and 360 px versions", () => {
    expect(thumbnailSources('https://secure.meetupstatic.com/photos/event/b/c/c/4/highres_536088324.jpeg')).toEqual({
      src: 'https://secure.meetupstatic.com/photos/event/b/c/c/4/global_536088324.jpeg',
      srcset:
        'https://secure.meetupstatic.com/photos/event/b/c/c/4/global_536088324.jpeg 180w, https://secure.meetupstatic.com/photos/event/b/c/c/4/event_536088324.jpeg 360w',
    });
  });

  it('uses any other image as it is', () => {
    expect(thumbnailSources('https://secure.meetupstatic.com/photos/event/other.png')).toEqual({
      src: 'https://secure.meetupstatic.com/photos/event/other.png',
    });
  });
});

describe('formatRating', () => {
  it('writes one decimal, as Meetup does', () => {
    expect(formatRating(4.89)).toBe('4.9');
    expect(formatRating(5)).toBe('5.0');
  });
});
