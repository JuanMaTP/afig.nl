// The Cloudflare-specific wiring, kept in one small module so the app stays portable (CLAUDE.md).
import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import { type Auth, authOrigin, createAuth, hostEmails } from './lib/auth';
import type { Database } from './lib/db';
import * as schema from './lib/db/schema';
import { type Fetch, type Tmdb, tmdbClient } from './lib/tmdb/client';

export function database(d1: D1Database = env.DB): Database {
  return drizzle(d1, { schema });
}

/**
 * Member sign-in for a request (src/lib/auth.ts), through the secrets `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`
 * and `GOOGLE_CLIENT_SECRET`. The origin is the request's, always https outside localhost (`authOrigin`): the
 * Worker answers only on afig.nl (and localhost).
 */
export function auth(url: URL): Auth {
  if (!env.BETTER_AUTH_SECRET) throw new Error('BETTER_AUTH_SECRET is not set');
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : null;
  return createAuth({ db: database(), origin: authOrigin(url), secret: env.BETTER_AUTH_SECRET, google });
}

/**
 * The hosts' sign-in emails, from the secret `HOST_EMAILS` (plan §5.9). Optional: without it nobody is a
 * host, and the host tools answer 404 to everyone.
 */
export function hosts(): Set<string> {
  return hostEmails((env as { HOST_EMAILS?: string }).HOST_EMAILS);
}

/** Whether "Continue with Google" can work: both of Google's secrets are set. */
export function googleSignInReady(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** TMDB, through the secret `TMDB_TOKEN`; null when the secret isn't set (plan §8, TMDB account and key). */
export function tmdb(token: string | undefined = env.TMDB_TOKEN, fetchFn: Fetch = (url, init) => fetch(url, init)): Tmdb | null {
  return token ? tmdbClient(fetchFn, token) : null;
}
