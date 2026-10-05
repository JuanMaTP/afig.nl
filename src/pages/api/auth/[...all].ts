// Better Auth's own routes (src/lib/auth.ts), among them Google's callback, /api/auth/callback/google.
import type { APIRoute } from 'astro';
import { auth } from '../../../cloudflare';

export const prerender = false;

export const ALL: APIRoute = ({ request, url }) => auth(url).handler(request);
