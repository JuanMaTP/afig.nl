// One event as a calendar file, for a card's "Add to calendar" (plan §5.1). On an iPhone it opens the
// "Add to Calendar" sheet; on a computer it downloads and opens in the calendar app.
import type { APIRoute } from 'astro';
import { database } from '../../cloudflare';
import { eventById } from '../../lib/agenda';
import { eventCalendar } from '../../lib/calendar';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = params.id ?? '';
  const event = /^\d+$/.test(id) ? await eventById(database(), id) : null;
  if (!event) return new Response('No such event.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  return new Response(eventCalendar(event, new Date()), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      // Inline, so iOS shows the event instead of a download; the name is for browsers that save it.
      'content-disposition': `inline; filename="afig-${id}.ics"`,
    },
  });
};
