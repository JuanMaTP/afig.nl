// "Sign out" posts here: Better Auth ends the session and clears its cookies, then back to the agenda.
import type { APIRoute } from 'astro';
import { auth } from '../../cloudflare';
import { withCookies } from '../../lib/auth-response';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const ended = await auth(url).api.signOut({ headers: request.headers, asResponse: true });
  return withCookies(ended, '/');
};
