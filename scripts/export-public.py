"""Builds the public showcase copy of the AFiG website in ../afig-public, from this repository's working tree
(tracked files and new ones git doesn't ignore): `python scripts/export-public.py`.

Left out, so the public copy holds no third party's content and no personal data: pages copied from cinemas'
and Meetup's sites (test fixtures), the archive's backfill data and its tool, the group's internal documents,
and the tests that need them (decided 5 October 2026). Re-run to refresh the copy; its .git and node_modules
are kept. Then commit and push from ../afig-public.
"""
import shutil
import subprocess
from pathlib import Path

SRC = Path(__file__).resolve().parent.parent
DST = SRC.parent / 'afig-public'

EXCLUDE_PREFIXES = [
    'test/fixtures/',
    'test/cinemas/',
    'test/meetup/',
    'scripts/backfill/',
    'docs/context/',
]
EXCLUDE_FILES = {
    'test/details/description.test.ts',
    'test/workers/agenda.test.ts',
    'test/workers/ingest.test.ts',
    'test/workers/backfill.test.ts',
    'test/backfill.test.ts',
    'README.md',
}
BACKFILL = 'migrations/0003_backfill_past_events.sql'
BACKFILL_STUB = """-- The one-time backfill of AFiG's past events from Meetup (docs/website-plan.md §5.2) went here. Its data,
-- the events' descriptions as the hosts wrote them, is left out of this public copy.
SELECT 1;
"""

README = """# AFiG website

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
"""


def tracked_files():
    out = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=SRC,
                         capture_output=True, check=True).stdout
    return sorted(set(p for p in out.decode('utf-8').split('\0') if p))


def excluded(path):
    return path in EXCLUDE_FILES or any(path.startswith(prefix) for prefix in EXCLUDE_PREFIXES)


def main():
    if DST.exists():
        for child in DST.iterdir():
            if child.name in ('.git', 'node_modules'):
                continue
            shutil.rmtree(child) if child.is_dir() and not child.is_symlink() else child.unlink()
    DST.mkdir(exist_ok=True)
    copied = skipped = 0
    for path in tracked_files():
        source = SRC / path
        if not source.is_file():
            continue
        if excluded(path):
            skipped += 1
            continue
        target = DST / path
        target.parent.mkdir(parents=True, exist_ok=True)
        if path == BACKFILL:
            target.write_text(BACKFILL_STUB, encoding='utf-8', newline='\n')
        else:
            shutil.copy2(source, target)
        copied += 1
    (DST / 'README.md').write_text(README, encoding='utf-8', newline='\n')
    print(f'copied {copied}, left out {skipped}, into {DST}')


main()
