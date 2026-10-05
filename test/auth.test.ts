import { describe, expect, it } from 'vitest';
import { authOrigin, hostEmails, initialOf, isHost, safeNext } from '../src/lib/auth';
import { withCookies } from '../src/lib/auth-response';

describe('safeNext', () => {
  it('keeps a path on this site, with its query', () => {
    expect(safeNext('/films?q=akira')).toBe('/films?q=akira');
    expect(safeNext('/films/129')).toBe('/films/129');
  });

  it('never sends anyone to another site', () => {
    for (const next of ['https://evil.example/', '//evil.example/', String.raw`/\evil.example`, 'javascript:alert(1)', 'films']) {
      expect(safeNext(next)).toBe('/');
    }
    expect(safeNext(null, '/films')).toBe('/films');
  });

  it('refuses tabs, line breaks and backslashes anywhere, which browsers drop or read as "/"', () => {
    for (const next of ['/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/ \t/evil.example', String.raw`/films\..\\evil.example`, '/films\u0000']) {
      expect(safeNext(next)).toBe('/');
    }
    // As a browser would send it: the query string decoded once by URLSearchParams.
    expect(safeNext(new URLSearchParams('next=/%09/evil.example').get('next'))).toBe('/');
  });
});

describe('authOrigin', () => {
  it('signs in over https outside localhost, even from an http request', () => {
    expect(authOrigin(new URL('http://afig.nl/sign-in'))).toBe('https://afig.nl');
    expect(authOrigin(new URL('https://afig.nl/auth/google'))).toBe('https://afig.nl');
    expect(authOrigin(new URL('http://localhost:4321/sign-in'))).toBe('http://localhost:4321');
  });
});

describe('withCookies', () => {
  it('redirects and keeps every cookie Better Auth set', () => {
    const from = new Response('{}', { headers: [['Set-Cookie', 'a=1; Path=/'], ['Set-Cookie', 'b=2; Path=/']] });
    const redirect = withCookies(from, 'https://accounts.google.com/o/oauth2/v2/auth?x=1');
    expect(redirect.status).toBe(303);
    expect(redirect.headers.get('Location')).toBe('https://accounts.google.com/o/oauth2/v2/auth?x=1');
    expect(redirect.headers.getSetCookie()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });
});

describe('initialOf', () => {
  const member = (name: string, email = 'someone@example.com') => ({ id: 'u1', name, email });

  it("takes the name's first letter, in capitals", () => {
    expect(initialOf(member('juan Manuel'))).toBe('J');
    expect(initialOf(member('  Ömer'))).toBe('Ö');
  });

  it('keeps a letter outside the basic plane whole, and falls back to the email', () => {
    expect(initialOf(member('𝒜lex'))).toBe('𝒜');
    expect(initialOf(member('', 'mia@example.com'))).toBe('M');
  });
});

describe('hostEmails and isHost', () => {
  const hosts = hostEmails(' Host@Example.com, second@example.org;third@example.net\nnot-an-email ');

  it('reads the list with commas, semicolons or spaces, in any case', () => {
    expect([...hosts]).toEqual(['host@example.com', 'second@example.org', 'third@example.net']);
    expect(hostEmails(undefined).size).toBe(0);
    expect(hostEmails('').size).toBe(0);
  });

  it('makes a host only of a verified email on the list', () => {
    expect(isHost({ email: 'HOST@example.com', emailVerified: true }, hosts)).toBe(true);
    expect(isHost({ email: 'host@example.com', emailVerified: false }, hosts)).toBe(false);
    expect(isHost({ email: 'member@example.com', emailVerified: true }, hosts)).toBe(false);
    expect(isHost({ email: 'host@example.com', emailVerified: true }, new Set())).toBe(false);
  });
});
