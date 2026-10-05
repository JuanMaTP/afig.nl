// A redirect that keeps the cookies Better Auth set on its own response (the OAuth state, the session).

/** 303 to `location`, carrying every Set-Cookie of `from`. */
export function withCookies(from: Response, location: string): Response {
  const redirect = new Response(null, { status: 303, headers: { Location: location } });
  for (const cookie of from.headers.getSetCookie()) redirect.headers.append('Set-Cookie', cookie);
  return redirect;
}
