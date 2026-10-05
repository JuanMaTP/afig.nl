// Per request: `Astro.locals.member()` reads the signed-in member once, and only when a page asks for it (the
// header, the members-only pages), so feeds and Better Auth's own routes never pay for it. Wiring only: the
// logic is in src/lib/auth.ts.
import { defineMiddleware } from 'astro:middleware';
import { auth, hosts } from './cloudflare';
import { type Member, signedInMember } from './lib/auth';

export const onRequest = defineMiddleware((context, next) => {
  let member: Promise<Member | null> | undefined;
  // A failure to read the session (D1 unavailable, no secret) shows the page signed out, never an error page.
  context.locals.member = () => (member ??= signedInMember(auth(context.url), context.request.headers, hosts()).catch(() => null));
  return next();
});
