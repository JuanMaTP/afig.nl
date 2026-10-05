// How the site writes dates, times and numbers. Times are stored in UTC and always shown in Amsterdam time.
import { SITE_TIME_ZONE } from './time';

// Built from parts, so the result doesn't depend on how a runtime's locale data punctuates dates.
const dayParts = new Intl.DateTimeFormat('en-GB', { timeZone: SITE_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' });
const timeParts = new Intl.DateTimeFormat('en-GB', { timeZone: SITE_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const monthParts = new Intl.DateTimeFormat('en-GB', { timeZone: SITE_TIME_ZONE, month: 'long', year: 'numeric' });

function part(formatter: Intl.DateTimeFormat, iso: string, type: Intl.DateTimeFormatPartTypes): string {
  return formatter.formatToParts(new Date(iso)).find((p) => p.type === type)?.value ?? '';
}

/** "Thu 1 Oct" */
export function formatDay(iso: string): string {
  return `${part(dayParts, iso, 'weekday')} ${part(dayParts, iso, 'day')} ${part(dayParts, iso, 'month')}`;
}

/** "October 2026" */
export function formatMonth(iso: string): string {
  return `${part(monthParts, iso, 'month')} ${part(monthParts, iso, 'year')}`;
}

/** "18:10" */
export function formatTime(iso: string): string {
  return `${part(timeParts, iso, 'hour')}:${part(timeParts, iso, 'minute')}`;
}

/** Up to this many places left, the agenda says so in a stronger colour. */
export const FEW_PLACES = 3;

export interface Attendance {
  /** "13 going · 7 places left", "20 going · full" or "3 going". */
  text: string;
  tone: 'open' | 'few' | 'full';
}

/** Null when the count is unknown. */
export function formatAttendance(going: number | null, rsvpLimit: number | null): Attendance | null {
  if (going === null) return null;
  if (rsvpLimit === null) return { text: `${going} going`, tone: 'open' };
  const left = rsvpLimit - going;
  if (left <= 0) return { text: `${going} going · full`, tone: 'full' };
  return { text: `${going} going · ${left} ${left === 1 ? 'place' : 'places'} left`, tone: left <= FEW_PLACES ? 'few' : 'open' };
}

/**
 * A cover image at two sizes, so phones load the small one. Meetup serves each event photo as
 * `highres_<id>.jpeg` (1920 px wide) and `600_<id>.jpeg`; any other URL is used as it is.
 */
export function coverImageSources(url: string): { src: string; srcset?: string } {
  const small = url.replace(/\/highres_(\d+\.jpeg)$/, '/600_$1');
  if (small === url) return { src: url };
  return { src: small, srcset: `${small} 600w, ${url} 1920w` };
}

/** "4.9": one decimal, as Meetup shows it. */
export function formatRating(average: number): string {
  return average.toFixed(1);
}

/**
 * A small cover for a row in the archive. Meetup also serves each event photo as `global_<id>.jpeg`
 * (180 × 101 px, about 6 KB) and `event_<id>.jpeg` (360 × 203 px, about 15 KB), measured 3 October 2026.
 * Any other URL is used as it is.
 */
export function thumbnailSources(url: string): { src: string; srcset?: string } {
  const match = /\/highres_(\d+\.jpeg)$/.exec(url);
  if (!match) return { src: url };
  const base = url.slice(0, match.index);
  const small = `${base}/global_${match[1]}`;
  return { src: small, srcset: `${small} 180w, ${base}/event_${match[1]} 360w` };
}
