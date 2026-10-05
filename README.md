# AFiG website

The website of **AFiG: Amsterdam Film Group**, a community film meetup in Amsterdam: *community first, films second,
with a strong preference for interesting cinema.* Live at **https://afig.nl**.

## What it does

- **Events:** every upcoming event of the group, read from its Meetup page every half hour, with the meetup time and
  the film start apart, the language and subtitles, the cinema and the number going. A calendar feed of its own
  (`/calendar.ics`), a month view and an archive of every past event.
- **Film finder:** is a film playing in Amsterdam, where, when and with which subtitles? A daily run reads the
  programmes of twelve cinemas (Eye, LAB111, De Uitkijk, Studio/K, Het Ketelhuis and more), one polite request at a
  time, honouring each site's `robots.txt`, and matches every film to TMDB only when the match is confident.
- **Recommend:** members who sign in suggest films and send screenings they spotted to the hosts.
- **Host tools:** what members recommended, the most recommended first, and the tips they sent.

## How it's built

[Astro](https://astro.build) 7 on **Cloudflare Workers**, with **D1** (SQLite, in the EU), Cron Triggers, Drizzle ORM,
Better Auth (Google sign-in), linkedom for reading cinema pages and the TMDB API for film data. Tests with Vitest, in
Node and in Cloudflare's runtime. Built by the group's organizer with [Claude Code](https://claude.com/claude-code).

- `docs/website-plan.md`: the plan, with every decision and its reasons.
- `docs/engineering.md`: how the site is built and kept running.
- `docs/brand/`: the visual direction and the logo, with the script that draws it.
- `CLAUDE.md`: the project's rules, as Claude Code reads them.

## About this copy

A snapshot of the private repository the site is developed in, refreshed now and then. Left out: the test pages
copied from cinemas' and Meetup's websites, the archive's one-time backfill (the events' descriptions as the hosts
wrote them), the group's internal documents in `docs/context/`, and the tests that need them. Links to those in the
docs point to files that aren't here.

## Running it

Node 22 or later.

```sh
npm install
npm run db:migrate:local     # the local D1
npm run dev                  # http://localhost:4321
npm test
```

Film matching and the Film finder need a TMDB token, and sign-in a Google OAuth client: put `TMDB_TOKEN`,
`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.dev.vars` (never committed).

## Credits

This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.

© AFiG: Amsterdam Film Group. The code is shared to read; it has no open-source licence.
