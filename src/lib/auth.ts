// Member sign-in (plan §6, §9): Better Auth on D1 through Drizzle, one instance per request. Google for now; the
// email link (Brevo) comes next. Plain module: src/cloudflare.ts passes in the bindings and secrets.
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import type { Database } from './db';
import { accounts, sessions, users, verifications } from './db/schema';

/** Where Better Auth answers: sign-in, the OAuth callback (`/api/auth/callback/google`), sign-out. */
export const AUTH_PATH = '/api/auth';

export interface AuthConfig {
  db: Database;
  /** The site's origin: https://afig.nl, or http://localhost:4321 in development. */
  origin: string;
  secret: string;
  google: { clientId: string; clientSecret: string } | null;
}

export function createAuth(config: AuthConfig) {
  return betterAuth({
    baseURL: config.origin,
    basePath: AUTH_PATH,
    secret: config.secret,
    trustedOrigins: [config.origin],
    database: drizzleAdapter(config.db, { provider: 'sqlite', usePlural: true, schema: { users, sessions, accounts, verifications } }),
    socialProviders: config.google
      ? {
          google: {
            ...config.google,
            prompt: 'select_account',
            // Collect only what a feature uses (plan §6): the name and email, not the Google picture, which
            // would also be loaded from Google's servers on every page.
            mapProfileToUser: () => ({ image: undefined }),
          },
        }
      : {},
    session: {
      // Long sessions, so members sign in rarely (plan §9).
      expiresIn: 60 * 60 * 24 * 90,
      updateAge: 60 * 60 * 24,
      // The session is read from a signed cookie for 5 minutes before D1 is asked again.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    // Collect only what a feature uses (plan §6): no IP addresses.
    advanced: { ipAddress: { disableIpTracking: true } },
    // Nor Google's tokens (no feature calls Google for a member; the ID token also carries the Google picture),
    // nor the browser's user agent. /privacy says so: change both together.
    databaseHooks: {
      account: {
        create: { before: async (account) => ({ data: { ...account, ...WITHOUT_TOKENS } }) },
        update: { before: async (account) => ({ data: { ...account, ...WITHOUT_TOKENS } }) },
      },
      session: {
        create: { before: async (session) => ({ data: { ...session, userAgent: null } }) },
      },
    },
    telemetry: { enabled: false },
  });
}

/** What Better Auth would store of Google's tokens: nothing. */
export const WITHOUT_TOKENS = {
  accessToken: null,
  refreshToken: null,
  idToken: null,
  accessTokenExpiresAt: null,
  refreshTokenExpiresAt: null,
} as const;

export type Auth = ReturnType<typeof createAuth>;

/**
 * The origin sign-in runs on: the request's, but always https outside localhost. A sign-in started on
 * http://afig.nl would otherwise set its cookies without `Secure` and send Google an http callback.
 */
export function authOrigin(url: URL): string {
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  return local ? url.origin : `https://${url.host}`;
}

/** A signed-in member, as the pages need them. */
export interface Member {
  id: string;
  name: string;
  email: string;
  /** One of the group's hosts (plan §5.9): their email is on the hosts' list, and verified. */
  host: boolean;
}

/** The signed-in member for a request, or null. `hosts` is the hosts' list, from `hostEmails`. */
export async function signedInMember(auth: Auth, headers: Headers, hosts: ReadonlySet<string> = new Set()): Promise<Member | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const { id, name, email, emailVerified } = session.user;
  return { id, name, email, host: isHost({ email, emailVerified }, hosts) };
}

/**
 * The hosts' list (the secret `HOST_EMAILS`): their sign-in emails, separated by commas or spaces. Kept out
 * of the repository, like any personal data.
 */
export function hostEmails(list: string | null | undefined): Set<string> {
  return new Set(
    (list ?? '')
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.includes('@')),
  );
}

/** A host signs in with an email on the hosts' list, which their provider has verified (Google always has). */
export function isHost(user: { email: string; emailVerified: boolean }, hosts: ReadonlySet<string>): boolean {
  return user.emailVerified && hosts.has(user.email.trim().toLowerCase());
}

/** The letter in the account button: the name's first, or the email's. */
export function initialOf(member: Pick<Member, 'name' | 'email'>): string {
  const [first] = Array.from((member.name || member.email).trim());
  return (first ?? '?').toLocaleUpperCase('en');
}

/**
 * Where to go after signing in: a path on this site only ("/films?q=akira"), never another site, so the
 * sign-in page can't be used to send someone elsewhere. It is also Google's callback, and `auth.api` doesn't
 * check that itself, so this is the only guard. Browsers drop tabs and line breaks from a URL ("/\t/evil.example"
 * becomes "//evil.example") and read "\" as "/", so neither is accepted anywhere.
 */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  const base = 'https://afig.invalid';
  try {
    if (new URL(next, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }
  return next;
}
