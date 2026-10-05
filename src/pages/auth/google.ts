// "Continue with Google" on /sign-in posts here, so signing in needs no JavaScript on the page. Better Auth
// starts the OAuth flow (its state in a cookie and in `verifications`); the browser then goes to Google.
import type { APIRoute } from 'astro';
import { auth } from '../../cloudflare';
import { safeNext } from '../../lib/auth';
import { withCookies } from '../../lib/auth-response';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const form = await request.formData();
  const next = safeNext(form.get('next')?.toString());
  const started = await auth(url).api.signInSocial({
    body: { provider: 'google', callbackURL: next, errorCallbackURL: `/sign-in?error=google&next=${encodeURIComponent(next)}` },
    headers: request.headers,
    asResponse: true,
  });
  const body = (await started.json().catch(() => null)) as { url?: string } | null;
  if (!started.ok || !body?.url) return withCookies(started, `/sign-in?error=google&next=${encodeURIComponent(next)}`);
  return withCookies(started, body.url);
};
