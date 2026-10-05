import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { database } from '../../src/cloudflare';
import { createAuth } from '../../src/lib/auth';
import { accounts, sessions } from '../../src/lib/db/schema';

// What /privacy promises: no Google tokens and no user agent in D1, whatever Better Auth is handed.
describe('what sign-in stores', () => {
  const db = database();
  const auth = createAuth({
    db,
    origin: 'https://afig.nl',
    secret: 'a-test-secret-that-is-long-enough-for-better-auth',
    google: { clientId: 'id', clientSecret: 'secret' },
  });

  it('keeps no Google tokens, on the first sign-in or a later one', async () => {
    const { internalAdapter } = await auth.$context;
    const user = await internalAdapter.createUser({ name: 'Mia', email: 'mia@example.com', emailVerified: true }, { method: 'oauth' });
    const account = await internalAdapter.linkAccount({
      userId: user.id,
      providerId: 'google',
      accountId: '1234567890',
      accessToken: 'ya29.access',
      refreshToken: 'refresh',
      idToken: 'eyJ.id.token',
      accessTokenExpiresAt: new Date('2026-10-05T00:00:00Z'),
      scope: 'openid,email,profile',
    });
    await internalAdapter.updateAccount(account.id, { accessToken: 'ya29.again', idToken: 'eyJ.again' });

    const [row] = await db.select().from(accounts).where(eq(accounts.id, account.id));
    expect(row).toMatchObject({ accountId: '1234567890', accessToken: null, refreshToken: null, idToken: null, accessTokenExpiresAt: null });
  });

  it('keeps no user agent with a session', async () => {
    const { internalAdapter } = await auth.$context;
    const user = await internalAdapter.createUser({ name: 'Ole', email: 'ole@example.com', emailVerified: true }, { method: 'oauth' });
    const session = await internalAdapter.createSession(user.id, false, { userAgent: 'Mozilla/5.0 (iPhone)' });

    const [row] = await db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(row?.userAgent).toBeNull();
    expect(row?.ipAddress ?? '').toBe('');
  });
});
