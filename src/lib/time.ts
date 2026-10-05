// Times are stored as UTC ISO strings (one format, so they sort as text) and shown in Europe/Amsterdam.

/** Where every event happens, and the zone every time on the site is shown in. */
export const SITE_TIME_ZONE = 'Europe/Amsterdam';

/** An ISO 8601 date-time with any offset, as a UTC ISO string. */
export function toUtcIso(dateTime: string): string {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) throw new RangeError(`not a date-time: ${dateTime}`);
  return date.toISOString();
}

export interface WallClock {
  year: number;
  /** 1 to 12. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * The UTC ISO string for a wall-clock time in an IANA time zone, such as an iCal
 * `DTSTART;TZID=Europe/Amsterdam`. Throws a RangeError for an unknown zone.
 */
export function zonedTimeToUtcIso(local: WallClock, timeZone: string): string {
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  // The zone's offset at the guessed instant, then again at the corrected one, which settles DST changes.
  const first = asUtc - zoneOffsetMs(asUtc, timeZone);
  return new Date(asUtc - zoneOffsetMs(first, timeZone)).toISOString();
}

/** The wall-clock time in an IANA time zone at a UTC ISO string. */
export function wallClockIn(iso: string, timeZone: string): WallClock {
  return wallClockAt(new Date(iso).getTime(), timeZone);
}

/** "2026-10-01": the calendar day in a time zone, for grouping and comparing days. */
export function dayKeyIn(iso: string, timeZone: string): string {
  return dayKey(wallClockIn(iso, timeZone));
}

/** The day key of the day after a given one. */
export function nextDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return dayKey({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() });
}

function dayKey({ year, month, day }: Pick<WallClock, 'year' | 'month' | 'day'>): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const w = wallClockAt(utcMs, timeZone);
  const wall = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wall - Math.floor(utcMs / 1000) * 1000;
}

function wallClockAt(utcMs: number, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(utcMs));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute'), second: part('second') };
}
