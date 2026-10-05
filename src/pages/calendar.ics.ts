// The calendar feed (plan §5.1), rendered from D1 on each request like the agenda.
import type { APIRoute } from 'astro';
import { database } from '../cloudflare';
import { upcomingEvents } from '../lib/agenda';
import { CALENDAR_KEEPS_DAYS, calendarFeed } from '../lib/calendar';

export const prerender = false;

export const GET: APIRoute = async () => {
  const now = new Date();
  const since = new Date(now.getTime() - CALENDAR_KEEPS_DAYS * 24 * 60 * 60 * 1000);
  const agenda = await upcomingEvents(database(), since);
  return new Response(calendarFeed(agenda, now), {
    headers: { 'content-type': 'text/calendar; charset=utf-8' },
  });
};
