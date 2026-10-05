# AFiG Website

Plan and working spec for the group's website. **Status: building. Baseline, stack and main choices decided 30 September 2026 (§8).** Built locally by 2 October 2026: the ingest (§9), the agenda with its calendar feed (§5.1) and the archive with the backfill (§5.2); not yet deployed. Features are added here as the organizer defines them.

Identity and philosophy: `AFG-Core.md` · Event format: `AFG-EventGuide.md` · Special events: `AFG-SpecialEvents.md` · Cinema tracking: `AFG-CinemaTracking.md` · Open strategic questions: `AFG-Decisions.md`

---

## 1. Purpose

Two goals, in this order:

1. **Make the group quicker to use.** A member should find the next events, and everything they need to go, in seconds from a phone.
2. **Make the group look and run more professionally**, without adding work for hosts.

The site supports Meetup and WhatsApp; it does not replace them. Meetup is where newcomers find the group (about 1,270 members on 30 September 2026) and where they RSVP. WhatsApp is where the community talks.

---

## 2. Principles

- **Hosts publish once, on Meetup.** The site reads from Meetup. A feature that makes a host enter the same information twice fails the efficiency goal.
- **One home per kind of data.** See §3.
- **Community first** (`AFG-Core.md`). Features should bring people to screenings and to the conversation afterwards, not stand in for either.
- **Screening selection stays with the organizer.** Member input informs programming; it does not decide it.
- **No logins until a feature needs one.** Every login is friction for the member the site exists to serve.
- **Automatic over manual.** A volunteer-run group eventually stops doing every manual step. Prefer feeds to data entry and hosted services to a server someone has to maintain, and write down how things work so another host can take over.
- **Mobile first.** Nearly everyone arrives from a link in WhatsApp.
- **English-language, Dutch setting**, as for event pages (`AFG-Core.md`, Audience).
- **Never show a guessed screening detail.** The project rule applies to the site: a field that can't be read reliably is left out, not filled in.

---

## 3. Where each kind of data lives

| Data | Home | How the site gets it |
|---|---|---|
| Official events | Meetup | The group's public events page, read automatically; the iCal feed as fallback (§4) |
| RSVPs and attendee lists | Meetup | Only the number going and the RSVP limit are copied, never names. The site links to the Meetup event (§5.5) |
| Past events | The site | Archived automatically as events pass, plus a one-time backfill (§5.2) |
| Film details and images | TMDB | TMDB API, matched by title, year and director (§4) |
| Recommendations and screening tips | The site | Member forms (§5.3) |
| Ratings and reviews | The site | Member form (§5.4) |
| Member-organized events | WhatsApp | Not copied (§5.6) |
| Special-event signups | The site, if built | Phase 3 (§5.5) |

---

## 4. Data sources — verified 30 September 2026

### Meetup: the events page, with the calendar feed as fallback

**Primary source: the group's events page**, `https://www.meetup.com/amsterdam-film-group/events/?type=upcoming`. Meetup serves it with every upcoming event embedded as structured data (the page's `__NEXT_DATA__` block), readable without a login and without running the page's scripts. Checked 30 September 2026:

- **All 15 upcoming events**, through *Dune: Part Three* (IMAX 70mm, field trip to Brussels) on 19 December.
- Per event: id, title, start and end time with time zone, full description, venue, status, **number going**, **RSVP limit** (`maxTickets`; 0 means none) and the **host's cover image** (`featuredEventPhoto`).
- **It also embeds personal data:** the first five attendees, the event's creator and its hosts. The ingest job discards all of it; the site never stores or shows attendee names (§5.5).
- **Where the data sits** (measured 1 October 2026): `props.pageProps.__APOLLO_STATE__`, a flat map of objects keyed `Event:<id>`, `Venue:<id>`, `Member:<id>`, `Rsvp:<id>`, `PhotoInfo:<id>`. Links between them are `{"__ref": "Venue:…"}` objects. The number going is `going.totalCount`. The personal-data fields to drop are `creatorMember`, `eventHosts` and `rsvps(...)`, plus the viewer fields `isAttending`, `rsvpState` and `isSaved`; every `Member:` and `Rsvp:` object is personal data (a `Member:` even has an `email` field, empty for a visitor who isn't logged in). The page is about 165 KB of HTML (36 KB compressed), with a 72 KB JSON block.
- **The list of upcoming events** is the group's `events({"filter":{"afterDateTime":…,"status":["ACTIVE","PAST","CANCELLED"]},"first":30,"sort":"ASC"})` entry, reached through `ROOT_QUERY` → `groupByUrlname:…`. It holds at most 30 events; `pageInfo.hasNextPage` says whether it was cut off. Cancelled events stay in it with status `CANCELLED`. Times carry their offset (`2026-10-01T18:10:00+02:00`); cover images are `PhotoInfo.highResUrl` on `secure.meetupstatic.com` (measured 1 October 2026).
- **Past events:** the `?type=past` page embeds only the 10 most recent of about 190 (188 on 30 September). The rest load as a visitor scrolls, through Meetup's internal API, so the backfill is a one-time extraction in a browser (§5.2), not a job. **Measured 2 October 2026:** the page's list counts 191 events (`totalCount`, cancelled ones included) and the group's `events(PAST)` 190. The list is drawn in the browser: the server's HTML has no event links, the drawn page links each event with `?eventOrigin=group_events_list` (and upcoming "similar events" with `group_similar_events`). An event's own public page (`/amsterdam-film-group/events/<id>/`, allowed by robots.txt) embeds the event in the same Apollo shape, with the number going in `rsvps({"filter":{"rsvpStatus":["YES"]}}).totalCount`.
- **Venues are duplicated.** Meetup holds the same cinema under several venue ids and spellings. Checked 1 October 2026: LAB111 under three ids, FilmHallen and De Uitkijk under two each. The site maps them to one venue through a `venues` table keyed by Meetup venue id (§9). The ids seen:

  | Cinema | Meetup venue ids (name as Meetup spells it) |
  |---|---|
  | LAB111 | 28353671 "LAB111" · 28339461 "LAB111" · 27337129 "Lab111" |
  | FilmHallen | 24839188 "de FilmHallen" · 23871261 "FilmHallen" |
  | De Uitkijk | 28339483 "Filmtheater De Nw. Uitkijk BV" · 28320614 "Filmtheater De Uitkijk" |

  Also seen: "Pathé Tuschinski". A venue id not in the table is flagged in admin, never guessed.

**Terms and robots.txt.** Meetup's Terms of Service (1 January 2026) bear on the site in two places:

- **§5.4** prohibits extracting data by scraping *"for a commercial purpose not permitted by these Terms"*. The site is non-commercial and reads only the group's own public event list, once every half hour.
- **§5.3(a)** bars reproducing, publishing or publicly displaying *"any portion of the Platform"* unless expressly permitted, **with no commercial qualifier**. Showing the events on the site is therefore less clearly allowed than reading them. This applies to the iCal feed as much as to the events page.
- **Decided 1 October 2026:** build as planned, and ask Meetup in writing for permission to show the group's own events. If they refuse, move to Meetup Pro or to links only (§8).

Meetup's `robots.txt` allows the events page and the iCal feed; it disallows the RSS feed (`*/events/rss/*`) and the internal APIs (`/gql*`, `/api/`), so the site uses neither. This is a reading of the terms, not legal advice.

**Risks.** Meetup can change the embedded structure without notice: the job then falls back to the iCal feed and flags it in admin. Meetup could also block requests from cloud servers, which is the first thing to test (§9).

**Fallback: the iCal feed**, `https://www.meetup.com/amsterdam-film-group/events/ical/`. Public, no login.

| Carries, per event |
|---|
| `UID` (`event_<id>@meetup.com`) · `DTSTART` and `DTEND` in `Europe/Amsterdam` · `SUMMARY` (the full event title) · `DESCRIPTION` · `LOCATION` · `URL` · `STATUS` · `CREATED` · `LAST-MODIFIED` |

- **It carries only the next 10 events.** Confirmed 30 September 2026: the feed returned 10 (to 11 October) while the events page showed 15, and adding `?count=30` changed nothing.
- **No RSVP counts, attendees or images.** On 1 October 2026 no event had a `LOCATION` line either: the venue is only in the description's `Where:` line.
- **The description is the events page's, with the group's name on a line above it** ("Amsterdam Film Group"). Without that line the two were identical for all 10 events on 1 October 2026, so a content hash matches whichever source was read. Long lines are folded at 75 bytes, never inside a character.
- **`DTSTART` is the meetup time** (the `When:` line), not the film start. `DTEND` is the end the host set, which `AFG-EventGuide.md` §6 takes from the cinema's published slot. The events page's start and end times are the same values.
- The Meetup event id (in `UID` and `URL`, and in the events page) is the stable key for archiving. `LAST-MODIFIED` matched `CREATED` on both entries checked, so whether it records edits is unconfirmed; the ingest job compares content instead (§9).
- The iCal URL can be subscribed to directly in a phone's calendar app, and works today, before the site exists. It shows the next 10 events only.
- **The RSS feed is not used:** `robots.txt` disallows it.

### Descriptions vary by host

The site cannot assume the `AFG-EventGuide.md` §5 format. Two formats were live on 30 September 2026:

| Field | Event Guide format (e.g. *Amores Perros*) | Another host's format (e.g. *Palestine 36*, *A River Runs Through It*) |
|---|---|---|
| Film start | `Film starts: 19:30` on its own line | `Film starts: 21:15` inside the meet line, or `The film starts at 18:45` |
| Language | `Language: Spanish with English subtitles` | `The film is in Arabic and English with English subtitles.` |
| Links | `Trailer:` · `Info:` · `Tickets:`, one per line | `[Trailer](…)` · `[Info](…)` · `[Tickets](…)`, or `Info and tickets:` combined |
| Auditorium | `Auditorium: Cinema 3` | `Theater: Lab 4` |
| Runtime | `2h 34m (154 minutes)` | `2 hours` · `2 hours and 3 minutes` |
| Seat | `My seat: Row 3, Seat 5` | `I'm in Row 4 seat 6` |

Titles vary the same way: `(English – No Subtitles)` against `(English without Subtitles)`, and some carry the year.

**Present in both formats:** `Directed by:`, `Year:`, `When:`, `Where:`, a YouTube trailer link, the cinema's own links, and a language bracket in the title.

**Checked again on the live events, 1 October 2026:**

- **Most events have no `Language:` line.** The language comes from the bracket in the title: "(Japanese w/ English Subtitles)", "(English without Subtitles)", "(English with subtitles in dutch)".
- **A loose pattern catches prose.** `Film starts:?\s*(.+)` matched "at 19:15. We will enter the theater approximately 15 minutes…", and `Theater` matches inside sentences. So labels are matched only at the start of a line, and only the `HH:MM` is taken from a time.
- **One host writes bold markdown:** `** 19:00`, `** LAB 4`. Bold can also cover only part of a label (`**Directed** by: Yoshiyuki Okuyama`), and a value can carry a link after it (`**Year**: 2025 [JFDB](…)`).
- **Titles carry emoji.** Printing them in a Windows console with the cp1252 code page crashes, so set `PYTHONIOENCODING=utf-8` in scripts.
- **Checked on the 190 past events, 2 October 2026:** 121 have a language bracket in the title. 44 more give the language only in one host's template sentence, "The film is in Japanese, with English subtitles."; the parser reads it, after the title and the `Language:` line, and only when it reads cleanly into "language · subtitles". Hosts also write "subititles", "w/ no subtitles" and abbreviations ("Eng w/ Nl subtitles"), and some mix a format or a year into the bracket ("IMAX Pathe English w/ Dutch Subtitles", "70mm version"): those are shown as written rather than read as a language. 12 state no language at all.

**Parsing rule:** extract what is reliably there, fall back to the Meetup description for everything else, and never display a guessed value. Accept the labels' variants (`Auditorium:`, `Theater:`, `Zaal:`). All hosts now include a short shared block (§8), which makes the key fields reliable.

### Meetup API — Pro only, not used for now

Meetup's API is available only with an active, paid **Meetup Pro** subscription (from $55 per group a month, or $47 on a 6-month plan), and a Pro subscription does not guarantee API approval. Its licence terms require the app to say that it uses the Meetup API but is not verified by Meetup, and forbid substantially replicating the platform. The API supports member sign-in (*log in with Meetup*, through its OAuth server flow); what it then exposes about a member's RSVPs is unverified. Without Pro, an organizer can download an event's RSVP list as a spreadsheet by hand (Organizer tools). Whether Pro is worth it: §9, Paid options.

### WhatsApp — no read access

WhatsApp's official business API cannot read an existing group or community. Its Groups API only manages groups the business creates itself, up to 8 participants, and requires a verified Official Business Account. Tools that read community chats do it by automating WhatsApp Web, which breaks WhatsApp's terms and puts the number running them at risk of a ban, in practice the admin's. **Not used.**

### TMDB — film details and images

The feeds carry no images, and the Event Guide's cover still (§8 there) lives only on the Meetup page. TMDB supplies details and backdrops instead.

- **Free for non-commercial use with attribution.** TMDB's binding API Terms (§3, last updated 20 October 2023) require the wording *"This website uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."* and the TMDB logo in an About or Credits section, less prominent than the site's own branding. The FAQ's shorter wording is not the binding one.
- **No caching longer than six months.** The Terms forbid keeping TMDB data longer, so `films` rows are refreshed before they turn six months old (§9). Rate limit: about 40 requests a second.
- **Non-commercial means no revenue at all.** The Terms (§2.A) count as commercial *"deriving revenues from the use or provision of TMDB … for commercial or monetary gain, directly or indirectly"*. Their examples include advertising and *"a 'destination' website, search engine, or interactive query-response system"*, which they don't define. **The site's key** (3 October 2026, §8) is on TMDB's free Developer plan: the organizer certified *"personal, non-commercial purposes"*, type *Website*, with a summary that describes the site as it is: public, run by volunteers for a group of about 1,270 members, with no ads, fees or revenue, and adding a search for where films are screening (mentioned because of that undefined example).
- **A match needs title, year and director.** Checked 1 October 2026 on the live events:
  - `EK` cleans all 14 current titles correctly, but cuts off a title that contains "with" or a language word: *Interview with the Vampire* becomes `interview`, *The English Patient* becomes `the`.
  - Titles repeat across versions: *5 Centimeters Per Second* is both the 2007 anime and the 2025 live-action film.
  - The `Year:` and `Directed by:` lines are in both description formats (above), so all three are available.
- TMDB records carry the **IMDb id**, which connects the site to the cinema-tracking method: every watchlist and ranked-list item there is keyed by IMDb id (`AFG Bulk Cinema Run.md`).
- **The catalogue, measured 2 October 2026:** TMDB's daily ID export of 1 October lists **1,251,743 films**. Anyone with an account can add a missing film; moderators remove entries outside the guidelines, which take festival screenings at selective venues but not student or amateur films. Duplicates are reported to the moderators, so an id can stop being valid; the daily export lists the ids that still are.
- **Alternative versions are not separate films** (extended editions, director's cuts, 3D versions). A 4K restoration is the same film: the version belongs to the screening, where the site already reads it (§8, Screening details).
- **Films and TV series have separate id spaces.** 154,843 numbers are both a film and an unrelated series: 149 is *AKIRA* and also *Journal Editorial Report* (1 October 2026 exports). Watchlists hold series too, and cinemas sometimes show one, so an id is always stored with its kind.
- `/find/{id}?external_source=imdb_id` returns the TMDB film for an IMDb id in one request; it also takes Wikidata ids.
- **Letterboxd's film data is TMDB's** ("Film data from TMDB", in its footer). Its own importer matches a file by `tmdbID`, `imdbID`, or title with year and directors, so a Letterboxd export would match the same way.

### IMDb and Wikidata — ids, not sources

Checked 2 October 2026.

- **IMDb's data can't be used.** Its Non-Commercial Datasets are for personal use and *"must not be altered/republished/resold/repurposed to create any kind of online/offline database of movie information"* (IMDb Help). Its Conditions of Use forbid *"data mining, robots, screen scraping, or similar data gathering and extraction tools"* without express written consent, and its `robots.txt` disallows the whole site to every robot outside a named list of search engines and link-preview bots (`User-agent: *` → `Disallow: /`).
- **The IMDb id is still the key the catalogues share:** IMDb's own CSV export, Filmladder's film pages, the cinema run's lists and Letterboxd's importer all use it. So the site stores it with every film that has one (§8, Film identity), taken from TMDB or from a member's own export, never from IMDb's site.
- **Wikidata** is CC0 and links the catalogues: *Akira* is Q1905968, with IMDb `tt0094625`, TMDB 149 and Letterboxd `akira`. But only 285,115 of its items carry a TMDB film id, under a quarter of TMDB's films. A possible extra cross-reference later, not a source.

---

## 5. Features

| § | Feature | Verdict | Phase |
|---|---|---|---|
| 5.1 | Official agenda | Build | 1a (launch) |
| 5.2 | Past events archive | Build | 1b |
| 5.3 | Recommendations | Build, as a group watchlist plus screening tips | 1b (forms) → 2 (votes, cinema-run matching) |
| 5.4 | Ratings and reviews | Build | 2 |
| 5.5 | Signups on the site | Special events only; Meetup stays the RSVP home | 3 |
| 5.6 | Member events from WhatsApp | No import; opt-in form if there is demand | 3 |
| 5.7 | Screening search and watchlist check | Build | Open |
| 5.8 | Shareable event image | Proposed | Open |
| 5.9 | Host tools | Direction; each tool defined with the hosts | Open |

### 5.1 Official agenda

All upcoming events from the group's events page, updated automatically.

Each event shows the title, date, **meetup time and film start as two separate lines**, venue, auditorium where given, ticket link, trailer, **number going and places left**, and an RSVP button that opens the Meetup event. Film details come from TMDB.

- The two times stay separate for the reason in `AFG-EventGuide.md` §7: conflating them has had people arrive an hour early.
- **Language and subtitles are prominent**, taken from the title's bracket. For most members it is the fact that decides whether they come (`AFG-Core.md`, Audience).
- A field that can't be read is replaced by the Meetup description, never by a guess.
- **Image:** the host's own cover image from Meetup; the TMDB backdrop when there is none.
- **Going, never who.** The number going and the places left under the RSVP limit; no names.
- A **Subscribe to the calendar** link offers the site's own feed, `/calendar.ics` (decided 1 October 2026). It holds every upcoming event, with the film start and the language in each entry. Meetup's iCal feed holds only the next 10 events and carries only the meetup time. The link opens to three choices: Apple Calendar (a `webcal://` link), Google Calendar, and the plain address for other apps. **The feed also keeps the past 30 days** (decided 2 October 2026), so a screening a member went to doesn't vanish from their calendar the day after.
- **How the agenda shows it** (built 2 October 2026): events grouped by day under headings that stay in view while scrolling ("Today", "Tomorrow", "Sun 4 Oct"). Each card: the still, with the format from the title as a tag on it ("4K Restoration", "IMAX 70mm"); the title without its brackets; the language as a pill ("Japanese · English subtitles"); "Meet 18:30" and "Film starts 19:15" on two lines; the venue and auditorium; the number going, in a stronger colour from 3 places left; a **Tickets** button when the description has a ticket link, and **RSVP on Meetup**, which reads "See on Meetup" when the event is full or cancelled. Both open in a new tab, so the agenda stays open behind them. **Add to calendar** (added 2 October 2026), under the venue on every card that isn't cancelled, adds that one event: as a file, `/events/<id>.ics`, which an iPhone opens straight into its calendar (Mac and Outlook too), or as Google Calendar's new-event form, filled in, for Android. The entry is the feed's own, with the same UID, so a calendar that has both sees one event. The feed's link above the agenda reads "Subscribe to the calendar", to tell the two apart.
- **A month view** beside the list (added 2 October 2026 as `/?view=month`; since 4 October the **Calendar** view of Events, at `/calendar`, and the old address redirects there; the list stays the default): one grid per month, weeks from Monday, from this month to the month of the last event. A day with events shows each event's still as a band of its own (stacked on a phone, side by side on wider screens; up to three, then "+1"); wider screens add each event's meetup time and title. In the list, a day with more than one event says how many in its heading ("Today · Fri 2 Oct · 2 events"). Each day links to its place in the list, where the details are.

### 5.2 Past events archive

- Every event the site has seen stays after it passes. Built from the feed; no host work.
- **Backfill** for events before launch: about 190 past events (188 on 30 September 2026), since the group started two years ago. Meetup's past-events page shows them all as a visitor scrolls, so the backfill is a **one-time extraction in a browser**, loaded into the database once.
- Each entry: film, date, venue. Ratings join in phase 2 (§5.4).
- Summary figures for newcomers, such as events held and venues visited.
- Photos showing identifiable people only with their consent. Film images come from TMDB.
- **Built 2 October 2026:** `/past`, linked from the header ("Upcoming · Past"; since 4 October the **Past** view of Events). It lists every event that has ended, latest first, by month: date, title, venue and language, one compact row each, linking to the event on Meetup. Cancelled events are left out (they didn't take place), and so are events that disappeared from Meetup before their date. Above the list: events held, venues visited (Meetup's several ids for one cinema count once) and the month of the first event. Images per row came on 3 October (below).
- **Backfill loaded 2 October 2026** (migrations `0002_venues_from_backfill` and `0003_backfill_past_events`): all 191 past events Meetup listed, from 28 October 2024, none failed; 190 show in the archive (one was cancelled). They brought 36 Meetup venue ids without an alias: 11 for venues already known (Eye alone had four more ids) and 25 for 19 new venues, from Kriterion and Cinecenter to KINO Rotterdam. Two were told apart by their events' descriptions ("Cinema" at Korte Leidsedwarsstraat 10 is Cinecenter; "De Kapel at LAB111" is LAB111). 178 of the 190 rows show a language; the other 12 state none anywhere.
- **Thumbnails and the group's rating, built 3 October 2026.** Each row shows the host's Meetup cover as a 96 px thumbnail: Meetup serves every event photo at 180 × 101 px (`global_`, about 6 KB) and 360 × 203 px (`event_`, about 15 KB), and the rows load lazily, so the page stays light. 192 of the 193 past events have a cover; the one without shows the still colour. Above the list, the group's average event rating from Meetup ("★ 4.9 from 403 ratings on Meetup"), which the ingest reads from the events page's group stats on every run (table `group_stats`).
- **How the backfill runs** (tools built 2 October 2026, in `scripts/backfill/`): in a private browser window on the past events page, paste `extract-past-events.js` into the console and scroll until it has every event's id; it then opens each event's public page, about one every 1.5 seconds, keeps only the fields the site uses, and downloads a JSON file. It never calls Meetup's API itself. Then `npx drizzle-kit generate --custom --name=backfill_past_events` creates an empty migration, and `node scripts/backfill/to-migration.mjs <file> migrations/<that file>` fills it: every event checked with the same rules as the ingest (an event that fails them is left out and reported), upcoming ones left to the ingest, and events the ingest already stored kept as they are. It reports Meetup venue ids without an alias, which get a migration of their own. **Never apply the migration while it is still empty:** D1 records it as applied and won't run it again.

### 5.3 Recommendations

AFiG doesn't choose films; it chooses screenings. A recommendation becomes an event only when a cinema plays the film with subtitles the group can follow (`AFG-Core.md`). So recommendations come in two kinds.

**A film for the group's watchlist.** The member searches a title (TMDB), picks it, and can add a line on why. It is stored as a film (§8, Film identity), so it carries its IMDb id. Duplicates merge into one entry; from phase 2, members vote for an entry instead of adding it again.

**A screening I spotted.** The member pastes a link to a screening or a venue. It goes to the organizer, not to a public list. This is how the fringe venues were found: Cinemercator and Oedipus are in no directory, and both came in because someone sent a link (`AFG-Core.md`, Fringe venues). New venues follow the intake procedure in `AFG Bulk Cinema Run.md` §10.

**Connection to the cinema run (phase 2).** The run already matches the organizer's watchlist and ranked list by IMDb id. The member watchlist can be a third list in the same run, and its matches can appear on the site as member picks playing now. How the site exposes the list to the run, and how the run publishes matches back, is still to be designed (§8).

- The page says plainly that the organizer programs: recommendations inform, they don't decide.
- ~~Phase 1 forms need no login. They are moderated, with basic spam protection.~~ **Members sign in to send either** (decided 4 October 2026, §8): sign-in is the spam protection, so no Turnstile, and the hosts can reply.

**Built 4 October 2026** (`src/lib/recommendations.ts`, `/recommend`, `/hosts`; tables `recommended_films`, `recommendations` and `screening_tips`, migration `0009`):

- **`/recommend`**, for members who sign in, in the header as **Recommend**. *A film for the group*: search TMDB as in the Film finder, pick the film (`/recommend/<TMDB id>`) and add a line on why if you like (up to 500 characters). The film is stored as every film is (§8, Film identity), so it is refreshed with the rest. A member can change their line or withdraw. A film's page in the Film finder links to it ("Recommend it to the group"). *A screening you spotted*: a link (http or https only; "https://" is added when left out) and an optional note; it goes to the hosts only.
- ~~**The group's list**, on the same page, for every member, with how many recommend each film.~~ **Only the hosts see what members recommend** (decided 4 October 2026, §8): a list others can see would sway members, or put them off recommending. A member sees **their own recommendations** on the page, with their line, to change or withdraw. Two members recommending the same film still merge into one entry with two names, so the hosts see how many want it (votes, phase 2, would have to keep the counts hidden too).
- **Moderation:** nothing a member types is shown to other members. A host can set a film aside (done, or not for the group); its recommendations stay.
- **Limits:** 30 recommendations and 10 tips per member a day, so a mistake or a script can't fill the hosts' list.
- **What the hosts see** (`/hosts`, §5.9): the tips, open first, with the site's name above the full link, the note and who sent it (name and email, so they can reply), and a Done button; the films, **the most recommended first** (or the latest, a switch away), with how many members, each member's line, whether it plays now and the group's last event with it.
- **Privacy:** the sign-in page and About say that the hosts see the sender's name and email; what a member sent is deleted with their account (the tables cascade).

### 5.4 Ratings and reviews

After an event, attendees rate the film and can write a short review.

- **Rating takes one tap.** The review is optional and short.
- **Prompt at the right moment:** a link in WhatsApp the morning after. Without a prompt, participation drops off quickly.
- **Group memory, not a critics' site.** Per past event: the group's average and a few short quotes. The conversation after the film is still the point (`AFG-Core.md`, Event types).
- **Spoiler-free by default.** Reviews are read by people who haven't seen the film; spoilers go behind a toggle.
- **No attendance check.** Meetup can't verify it automatically, and trust is fine at this scale.
- Needs sign-in (§6) so each person rates once.
- Over time, the ratings show what the group responds to, which is useful input for programming.

### 5.5 Signups

**Meetup stays the RSVP home for regular events.** The site's RSVP button opens the Meetup event.

Why the site doesn't take signups for regular events:

- No attendee lists without Meetup Pro (§4). The number going does come from the events page, and the agenda shows it (§5.1).
- Two lists split attendance. Hosts have to check both, capacity limits break, and events look emptier to newcomers browsing Meetup.
- Showing Meetup attendee names on the site republishes personal data members didn't agree to share there (GDPR).
- At cinema events members buy their own tickets, so the RSVP is social, and Meetup already handles that.

**Where site signups make sense (phase 3):** events Meetup handles badly, such as private screenings with limited paid seats (`AFG-SpecialEvents.md`) and home screenings where the address should go only to confirmed guests.

### 5.6 Member events from WhatsApp

**No automatic import.** There is no official way to read the community, and unofficial tools risk a ban on the admin's number (§4).

- **Consent.** These events are posted in a members-only chat, sometimes with home addresses. Publishing them needs the consent of the member who posted each one.
- **Brand.** They would appear under the AFiG name without AFiG hosts organizing them.
- **Audience.** Chat members already see these events in WhatsApp. The only new audience is people outside the chat, which is exactly who the consent point is about.

**If there is demand (phase 3):** an opt-in *Member events* form for members who want wider visibility, clearly labeled as organized by members.

### 5.7 Screening search and watchlist check

**Proposed 1 October 2026; chosen as the next feature on 2 October 2026. Its source and its phase are still open (§8).** Two things for members, on the public site:

- **Search a film:** the watchlist check for a single film. Is it playing in Amsterdam, at which cinemas, when, and in which version. It is about the city's screenings, not the group's events (clarified by the organizer, 3 October 2026).
- **Check a watchlist:** a member brings their IMDb watchlist and sees which of its films have screenings coming up.

Both follow the organizer's cinema-listing method from the **Film** project (organizer's personal Claude account, the *cinema listing* chat): the bulk cinema run, `docs/context/AFG Bulk Cinema Run.md` (v11, 21 September 2026), whose title cleaners and matcher are in `docs/context/AFG-Matcher.md`. The copy (3 October 2026) is complete but lost its formatting: headings, tables, code blocks and step numbers. Its companion `AFG-CinemaTracking.md`, with the deep methods for Eye, LAB111 and De Uitkijk, the staleness rules and the watchlist check, is not in this repository yet.

**What the run gives, and what the site needs.** The run reads each cinema's programme in a browser and finds titles in programme; its own §8 says these are not confirmed showtimes. The site needs dated screenings, so for each cinema it reads the programme and then each film's page: date, time, and the version where the cinema states it. The run's registry records how each venue publishes. Checked with a plain fetch on 2 October 2026, for the seven venues that yield most (the run's §3):

| Venue | What a plain fetch returns | `robots.txt` |
|---|---|---|
| Eye | `/en/whats-on/all-films`: 120 film links (`/en/whats-on/<slug>/<id>`); the times are on each film's page, as JSON-LD `startDate`s (how many belong to the film itself is still to check) | Allows all |
| LAB111 | `/programma/`: 77 `/movie/<slug>` links | Allows all |
| De Uitkijk | Homepage: 31 `/film/<slug>` links | Allows all, `Crawl-delay: 5` |
| Kriterion | Homepage: no film links (drawn in the browser), but its JSON-LD carries 91 `ScreeningEvent`s, 2 to 30 October, each with start, end and ticket link | Allows all but `/intern/` |
| FilmHallen | Homepage: 149 `/films/<slug>` links. Each film's page has its dates in `.timetable__date` blocks and its credits as text: *A River Runs Through It* reads "Land VS · Taal Engels · Ondertitels Nederlands · Speeltijd 123 · Regie Robert Redford · Jaar 1992" | Allows the programme; disallows `/filmladder`, and shuts out a few crawlers by name, ClaudeBot, GPTBot and Amazonbot among them |
| The Movies | Homepage: 42 `/films/<slug>` links; the same CMS as FilmHallen | As FilmHallen |
| Studio/K | Homepage: 29 `/film/<slug>` links, often with the year and the strand in the slug (`alice-1988-strings-of-imagination`) | Allows all |

**Terms checked 3 October 2026** (each site's terms, privacy and house-rule pages, and `robots.txt`): none of the seven has a clause on copying, automated reading, database right (*databankenrecht*), reuse of programme data or linking. What matters:

- **De Uitkijk:** `Crawl-delay: 5`, so one request every 5 seconds there, not 2.
- **FilmHallen and The Movies** (one operator, MoHa Holding B.V.): `/filmladder` and `/narrowcasting` are disallowed for every agent, and ClaudeBot, GPTBot and Amazonbot for the whole site. The site's reader isn't one of those, but given that stance, ask MoHa first.
- **Kriterion** has no legal page at all; two information pages ("Overige informatie", "Over Kriterion → Algemeen") are still to read in a browser. Its film pages are drawn in the browser from a CMS API. The homepage's JSON-LD carries 73 `ScreeningEvent`s (3 to 31 October) with start, end and ticket link, and the year only sometimes, in the name; no director, language or subtitles. Worth asking Kriterion, which would likely cover Studio/K, *"het jongste zusje van Stichting Kriterion"*.
- **Studio/K** film pages are server-rendered with labelled lines (`Regie:`, `Land:`, `Taal:`, `Ondertiteling:`, `Jaar:`, no runtime) and each showtime with its subtitles and ticket link. Its JSON-LD is unreliable (a template's location, a 10-minute end).
- The database right and copyright apply whatever the terms say: taking only facts (date, time, stated version, ticket link), not descriptions or images, keeps the risk low.

The rest of the registry needs more (the run's §5). Cineville's theatre pages load their showtimes from Cineville's API after the page arrives (checked 2 October 2026). Vue's programme is a carousel read by scrolling, and Griffioen's a date picker. Pathé's showtimes come from its app's own API (`/api/show/…`), whose terms and `robots.txt` come first.

**Traps the run recorded that apply directly:**

- **A venue's index keeps spent titles** with no future date. Presence is never a screening: a film counts only with a date still ahead.
- **FilmHallen's and The Movies' JSON-LD times are an hour out from 25 October** (winter time); their page text is right. FilmHallen's page-level JSON-LD also carries the whole site's schedule, not the film's.
- **Every matcher defect so far was silent under-reporting**, caught only by reading one venue's raw list against its hits. Tests with each venue's real page, trimmed, guard against it here.
- Plus the gates themselves (the run's §4): freshness, currency, year and runtime.

**Filmladder** (checked 2 October 2026) would be the simplest source, but it can't be the main one:

- **One page has everything for the coming week:** `filmladder.nl/amsterdam/bioscopen` (2.2 MB, server-rendered) lists 25 Amsterdam cinemas, Pathé and Vue included, with 3,245 screenings of 204 films from 2 to 8 October, start times with their offset. Each film's page carries its IMDb id.
- **Its terms forbid using it without written permission.** `/auteursrecht` claims copyright and database right (*databankenrecht*): *"Het geautomatiseerd of handmatig kopiëren van informatie of materiaal van filmladder.nl is niet zonder toestemming toegestaan"*, and storing or distributing any part needs prior written permission (info@filmladder.nl). `/techniek`: no API for third parties. `robots.txt` disallows `/film/*voorstellingen` and `/kaartjes/*`. Linking is explicitly allowed.
- **It sees only the coming week, and misses repertory.** On 19 August its city list lacked 7 of the 12 matches the venue sweep found (the run's §8). Watchlist matches are mostly classics scheduled weeks or months ahead (FilmHallen to December).
- **It doesn't state subtitles;** it marks only dubbed versions, "(NL)".
- At most a safety net for "playing this week", and only with permission.

**Proposed shape:**

- **A `screenings` index in D1, refreshed by its own cron** once or twice a day: the cinema (through `venues`), the title as billed, the year when stated, start and end, the version only as the cinema states it (language, subtitles, format), the ticket link, the source page, and when it was last seen. A screening no longer listed, or past, drops out. Searches read the index, never the cinemas.
- **Each billed title is matched to a film (§8, Film identity) only when the match is confident:** the IMDb id where the source gives it, otherwise TMDB by title, year and director. Only verified matches are cached; the run's §3 measured why: a search endpoint always returns something, often the wrong film. The run resolves a title billed in another language (*Das Leben der Anderen* for *The Lives of Others*) through IMDb's suggestion endpoint, which the site can't use (§4, IMDb and Wikidata). TMDB's search does the same job: it searches *"original, translated and alternative titles"*.
- **The seven venues above first,** one module and one test with the venue's real page each, then the rest, each after a check of its terms and `robots.txt`, as for Meetup (§4).
- **The page names the cinemas it covers and the ones it doesn't** (the run's §6).

**Built 3 October 2026, with Studio/K as the first cinema, end to end** (`src/lib/cinemas/`, `src/lib/screenings.ts`, `/films`):

- **The daily cinema run** (second cron, 04:15 UTC): robots.txt first, then the programme and each film page, one request at a time, at least 2 seconds apart (more when robots.txt sets a Crawl-delay), User-Agent `afig-website (+https://afig.nl)`. A read is complete unless the programme fails, lists no film, or more than a fifth of the film pages fail; only a complete read replaces the cinema's screenings, and every read is recorded in `cinema_reads` with its counts and problems.
- **Tables:** `billed_films` (one row per film page at a cinema: the title as billed, the year, director, runtime, language and subtitles as stated, and its film once matched), `screenings` (start, the screening's own subtitles when it states them, ticket link) and `cinema_reads`.
- **Matching** uses the events' rule (§8, Film matching for events), with the title the reader cleaned ("Akira (4K Restoration) (ENG SUBS)" → "Akira"); a film page is matched again only when its title, year or director changes.
- **The pages:** `/films` searches TMDB for a title, in any language, and lists what is playing; `/films/<TMDB id>` lists the film's screenings by day, with the cinema, the version as stated and the ticket link: each day under a heading that stays in view while scrolling ("Today · Sat 3 Oct · 3 screenings", as in the agenda) and its screenings on one card, or, in a month view (`?view=month`) like the agenda's, each day's times, linking to that day in the list. Pages at a cinema with the same title that couldn't be matched are shown apart, as "possibly this film". Both name the cinemas read and those not yet, and carry TMDB's attribution. **In the site's menu as Films since 4 October 2026**, for members who sign in (§8).
- **Read live on 3 October 2026:** Studio/K's 28 film pages, complete; 25 matched to the right film. Not matched: *Leviticus* (the page's year, 2016, isn't TMDB's), *Anomalisa* ("Charlie Kauffman"; it shows as "possibly"), and a Dutch title TMDB doesn't know (*Shaun het Schaap: Het Beest op de Boerderij*).

**Eye, LAB111 and De Uitkijk added the same day** (`src/lib/cinemas/eye.ts`, `lab111.ts`, `uitkijk.ts`). The cinemas are read at the same time, each at its own pace, so the run takes as long as the slowest (Eye, about 5 minutes). A cinema's failure, even an unexpected one, is recorded as its read and costs the others nothing.

- **LAB111:** the programme page carries every film and screening (labelled lines, a row per screening with its ticket link), so one request reads the whole cinema. No spoken language is stated. A screening announced before ticket sales open has no link, and is kept without one.
- **Eye:** `/en/whats-on/all-films` links 118 film pages of about 1 MB each. The `Movie` JSON-LD gives the director, year, runtime, languages and subtitle languages; the page's own data (Next.js) gives each screening with its ticket link and its subtitles as an id. Two ids are known, Dutch and English, worked out by elimination from films with one language, never by order; a screening shows them only when the film's JSON-LD names that language. A page without `Movie` JSON-LD is a programme (shorts, workshops, a double bill such as "Not Guilty + New Rose Hotel"): its screenings are kept under the page's title and not matched to a film.
- **De Uitkijk:** the homepage links 31 film pages; each has labelled lines and a ticket link per screening, whose `data-date` is the start. `Crawl-delay: 5` is honoured.
- **The first full run, locally:** all four complete, 253 film pages and 791 screenings. 190 matched, and every match checked by hand was the right film, original titles included (*Mond* → *Moon*, *Ascenseur pour l'échafaud* → *Elevator to the Gallows*, *Wan Pipel* → *One People*). Of the rest, 20 are Eye programmes, and the others give a year or director spelling TMDB doesn't have ("Andrej Tarkovski", *Steel Magnolias* "1985").
- **Het Ketelhuis, Cinecenter and Rialto De Pijp added the same day**, after their terms were checked (below):
  - **Het Ketelhuis** (`ketelhuis.ts`): `/films/` links its 63 film pages (`/specials/` are strands). Its JSON-LD times are wrong ("2026-10-08T14:15:00+1:00" for a screening the page shows on 9 October at 14:15), so the screenings are read from the page. The language line carries the subtitles too ("Noors gesproken en NL ondertiteld"); its Expat Cinema strand is Dutch film with English subtitles.
  - **Cinecenter** (`cinecenter.ts`): a new site on the Tricket ticketing platform; the homepage's schedule component carries the whole programme, a month ahead, so one request reads it. The "Eng Subs: …" productions sometimes say Dutch in their subtitles field; the title's mark wins. Its `releaseDate` is the Dutch release, not the film's year, and isn't used.
  - **Rialto De Pijp** (`rialto.ts`): `/en/films` links 43 film pages; each screening carries its own labels ("Eng subs"), so the subtitles are per screening. Its JSON-LD lists a film's release day at midnight as if it were a screening, so it isn't read. Its ticket links are written with http://; the ticket site answers https://.
  - **Read locally, all seven cinemas complete:** 384 film pages, 1,076 screenings; 303 matched, every match checked by hand, among them *L'inconnue* → *The Unknown*, *Roter Himmel* → *Afire*, *Tegenwoordig Heet Iedereen Sorry* → *Everyone's Sorry Nowadays*.
- **FC Hyena and Cinema De Vlugt added the same day** (`fc-hyena.ts`, `vlugt.ts`; FC Hyena, which had no Meetup venue, through migration `0006`):
  - **FC Hyena** is built with Framer. Its film pages (`/films/<id>`, the production's id on its ticket site) are linked only from `sitemap.xml`, which the reader reads as its programme. Each page has labelled facts (director, runtime, country, language, year) and its screenings as `<time datetime="2026-10-04T15:45:00.000Z">15:45</time>`: the Amsterdam time with a "Z", since Framer shows CMS times in UTC (its formatter sets `timeZone: 'UTC'`), so every visitor sees 15:45. The reader takes the time as shown and refuses a page where the two differ. The page is rendered when the cinema publishes the site, so it carries one week from that day (1 to 7 October, read on 3 October); its day labels ("Today", "Saturday") are of that day and aren't read. The ticket link is the production's, not the screening's.
  - **Cinema De Vlugt** (WordPress): the homepage links the films playing now; those scheduled later are only on `/verwacht/` (4 on 3 October), and strands on `/specials/` and `/kids/`, so a reader can now name more index pages, and any of them failing fails the read. Each screening has its full date, time and ticket link. No year is stated: it is taken from the title ("Bint El-Haras (1967)") or the slug's end (`palestine-36-2025`), never when the title carries that number itself (*Blade Runner 2049*).
  - **Read locally, all nine cinemas complete:** 434 film pages, 1,166 screenings. Of the two new cinemas' 50 films, 36 matched, every match checked by hand (*Het Vergeten Eiland* → *Forgotten Island*); the rest are previews with no director, Dutch-dubbed children's films, Turkish films and Arabic classics TMDB doesn't find by these titles, and *Fjord* (Mungiu), whose title search misses it.
- **Melkweg added the same day** (`melkweg.ts`), after its terms were checked: robots.txt allows everything, with no Crawl-delay; its house rules and privacy statement say nothing about reading or reusing the programme; its visitor terms (the VNPF's standard terms, 2013) are a scanned PDF about tickets and admission, not read by machine.
  - `/nl/agenda/` carries every event in its page data (`__NEXT_DATA__`), concerts and club nights included; the cinema's are those whose profile is "Film" (13 on 3 October, to December). Each event is one screening with its own page, whose data gives the director, year, runtime, spoken language and subtitles as codes ("JP", "EN"; "-" when none is stated), the start in UTC and a Ticketmaster link.
  - **The start is the event's, as Melkweg lists it:** usually an intro a quarter of an hour before the film ("20:00 Intro / 20:15 Naked (1993)"), once the doors. The schedule is free text and isn't read.
  - Some ticket links are a Ticketmaster search ("?q=kaboom"), not the screening's, and are left out. Ticketmaster is only linked to.
  - **Read locally, all ten cinemas complete:** 447 film pages, 1,179 screenings. Melkweg's 8 matches checked by hand (*NOFX: 40 Years of Fuckin' Up + Q&A: El Hefe* → *40 Years of Fuckin' Up*); *Miles* doesn't match, since Melkweg gives it another film's directors.
- **Cinema The Pulse and Filmhuis Cavia added the same day** (`the-pulse.ts`, `cavia.ts`; Cavia, which had no Meetup venue, through migration `0007`), after their terms were checked: The Pulse's robots.txt names no user agent, so its rules (paging, `/scripts`) bind no robot, and its only legal page, the privacy statement, says nothing about reuse; Cavia's robots.txt disallows only the CMS's folders, and its house rules and ticket pages say nothing about reuse.
  - **The Pulse** (Webflow): the homepage links every film page (38; the sitemap lags behind it). Each has labelled facts in English words and each screening with its day, time and room, plus the same moment written out for the page's script ("10/3/2026 4:15 PM"); the reader refuses a page where the two disagree. Tickets are sold in the cinema's app, so there is no ticket link. The version with English subtitles is a page of its own.
  - **Cavia** (Concrete CMS): the homepage links the month's programme (`/programma/oktober-2026`), so a programme reader can now read the pages its index links, and any of them failing fails the read. The page is written by hand: each screening a section after an `<hr>`, with its day and time ("Donderdag 1 oktober, 20:00"), title and a credit line ("Eduardo Coutinho | 1984 | Brazil | 119’ | EN subtitles"), read only in that order. A section whose day can't be read is a problem, not a guess. A title in brackets is tried as the film's other title. No spoken language is stated and there is no ticket link.
  - **Read locally, all twelve cinemas complete:** 503 film pages, 1,306 screenings. The two new cinemas' 41 matches all checked by hand (*Cabra Marcado Para Morrer* → *Twenty Years Later*, *Les Parapluies de Cherbourg* → *The Umbrellas of Cherbourg*); the rest are programmes of shorts, talks and lectures with no single director.
- **The rest, checked on 3 October 2026, can't be read as the others are:**
  - **Rialto VU Griffioen** and **Vue** draw their programme in the browser from their ticket systems' own endpoints (Griffioen's `/framework/public/ajax/…`, Vue's Sitecore API); the pages carry no screenings. **Pathé** likewise (its app's `/api/show/…`; robots.txt disallows `*/filters/*`, the showtime pages). All three wait for Browser Run (§9), or for their terms to allow those endpoints.
  - **De Omval** (Diemen) sends every request, robots.txt included, to a CDN check page (`/csq/`): bot protection, so it isn't read.
  - **Ventilator Cinema** (OT301): its agenda comes from Amsterdam Alternative's events service, about five film events in two months, mostly special screenings with no director or year, so nothing would match. Not read for now.
  - **Cinema Amstelveen** is closed for renovation until mid-October 2027 (the cinema run's registry).
  - **De Balie** still refuses the connection from the organizer's PC (DNS resolves; the TLS handshake fails, likely its VPN). To try from the deployed Worker or without the VPN.
  - **Kriterion**, **FilmHallen** and **The Movies** wait for permission (above).
  - **Cineville, as a way to the others, is closed too** (checked 3 October 2026). The cinema run reads Griffioen, De Omval and Het Documentaire Paviljoen through Cineville's theatre pages, in the organizer's own browser. Those pages carry only the theatre's details: the screenings come afterwards from `api.cineville.nl`, whose robots.txt disallows everything (`User-agent: *` / `Disallow: /*`). A reader, even through Browser Run, would make those requests itself, so it doesn't. `cineville.nl` has no robots.txt, and its terms are the pass's (subscription, payment, reservations), with nothing on the website. Cineville could be asked for a feed: it would cover every venue in its network at once.
- **Terms of six more sites checked on 3 October 2026:** Het Ketelhuis, Cinecenter, Rialto De Pijp, FC Hyena and Cinema De Vlugt have no clause on copying, automated reading, database right, reuse of listings, linking or AI, no Crawl-delay, and block no AI agent by name; FC Hyena has no legal pages at all, and Cinecenter no robots.txt. **De Balie** refused every connection (TLS handshake), so its robots.txt and terms are unknown and it isn't read. **The ticket sites of Het Ketelhuis, Rialto, FC Hyena and De Vlugt disallow every robot:** readers take the ticket links from the programme pages and only link to them, never fetch them.
- **D1's limits shape the code:** a query takes at most 100 bound parameters, so a cinema's screenings are replaced through a subquery, not a list of ids (Eye has some 120 films), and inserted 25 rows at a time; an invocation makes at most 1,000 queries, so the daily run matches 150 films and each 30-minute run 30 more.

**The watchlist** (proposed):

- **The member exports their watchlist from IMDb** as a CSV and picks the file. The export takes several steps since IMDb changed it, so the page walks them through, with direct links. The id is in the column `Const` (`tt…`); the other columns are still to be confirmed with a real export, "Original Title" especially.
- **The browser reads the file and matches it against the screenings:** by IMDb id where the screening's film is known, otherwise by the run's title keys with the year gate. A containment match shows as "possible", as the run treats it.
- **The list never leaves the device and needs no login.** The device remembers it, so later visits match it against the day's screenings; it is imported again only when it changes.
- **A link to the list can't be read** (checked 2 October 2026): IMDb's `robots.txt` and Conditions of Use rule it out (§4, IMDb and Wikidata), and a browser can't read imdb.com from afig.nl either.
- **From phase 2, signed-in members can keep their watchlist on the site** (§9, Tables), which makes it personal data the site holds (§6).

To settle before building it:

- **The source,** venue by venue, after each one's terms and `robots.txt`; and whether to ask Filmladder for permission.
- **The phase:** before or after the launch.
- **What counts as a confident match** for a billed title. Few cinemas give the title, year and director together: FilmHallen names the director and runtime but the year only sometimes; Studio/K names the director and year but not the runtime; Kriterion's screenings carry no director, and the year only sometimes. The events' rule (§8, Film matching for events) is a starting point. The run accepts a match on the year (its §3) and compares runtimes when there is no year (its §4).
- **Never a guessed detail:** a version the cinema doesn't state (original or dubbed, subtitles) is left out, as on the agenda.

### 5.8 Shareable event image

**Proposed 2 October 2026; the phase is still to come.** Export one image per event with everything a member needs to decide, ready to share in WhatsApp or on social media.

- **What it shows:** the film still, with the title, director and year. Then the date, with the meetup time and the film start as two separate lines (`AFG-EventGuide.md` §7). Then the cinema and auditorium, the presentation format when stated (35mm, IMAX, 4K restoration) and the runtime. **Language and subtitles are prominent**, as on every event.
- **What it leaves out:** the seat line, which stays on the Meetup page (Event Guide §7). The number going, which changes by the hour. Names, always (§5.5).
- **It goes with the WhatsApp announcement and never replaces it.** The announcement exists to get members to open the Meetup page (Event Guide §7), and a link in an image can't be tapped. So the Meetup and ticket links stay in the message.
- **Not the cover image.** The Event Guide allows no text on the cover (§8 there), so this is a separate image.
- **Made from the site's data when it is downloaded.** A new download always carries the current details, and the host enters nothing twice: everything comes from Meetup (§2). An image already posted can't change, so it carries the site's address, where the details stay current.
- **Never a guessed detail:** a field the site can't read is left out of the image too.
- **Brand:** the logo small, the still the hero (`docs/brand/design-direction.md`).
- **Needs** the description parser (film start, language, auditorium, format), and TMDB for director, year and runtime when the description lacks them. It could share its renderer with the Open Graph image the event pages need for link previews (§9).


### 5.9 Host tools

**Direction set by the organizer on 4 October 2026; nothing specific yet.** Beside what it shows members, the site will offer the hosts tools to organise the group. The first ideas: organising attendees, and information about the events each host wants to create. More will be discussed later.

What already shapes them, to keep in mind as each is designed:

- **Hosts publish once, on Meetup** (CLAUDE.md, Rules). A tool may prepare an event, for instance write the description's four labeled lines (`Film starts:` · `Tickets:` · `Language:` · `Auditorium:`) for the host to paste into Meetup, or keep what Meetup can't hold. It never asks a host to type the same event twice; what is published on Meetup comes back through the ingest.
- **Attendees:** the site can't see who goes on Meetup. The attendee list needs Meetup Pro (§4), and the ingest discards the names the events page carries (§4, §5.5). So organising attendees works on the site's own data: members who sign in and sign up on the site (as for special events, §5.5), with what they agreed to share. That is personal data: a privacy notice, consent and deletion on request (§6), kept in the EU D1 and never passed through Workflows (§9).
- **Who is a host** (decided 4 October 2026, with the first tool, §8): a member with a host role, one sign-in for everything. The role comes from the secret `HOST_EMAILS`, the hosts' sign-in emails, and needs an email the provider verified. Every host page, endpoint and Action checks it on the server, and answers 404 to anyone else (CLAUDE.md, Admin security). Cloudflare Access on `/admin` isn't used.
- **Built 4 October 2026:** the pages at `/hosts`, the **Hosts** category of the site's navigation (§8, Navigation by category), which only hosts see, with a count beside each tool for what waits. Its first tools are the screening tips and the recommended films (§5.3). A new host tool is one more entry in that category.
- **Where they live:** together, in the navigation's **Hosts** category, below the group and the tools, shown to hosts only (`docs/brand/design-direction.md`, Navigation and account).

---

## 6. Accounts, privacy and running the site

**Accounts.** Phase 1 needs none. Ratings, votes and special-event signups need members to be recognisable; when they arrive, use email sign-in links (no passwords). *Log in with Meetup* would need the Meetup API (§4).

**Privacy (GDPR).** Once the site stores names or emails, the group is responsible for that data:

- a short privacy notice saying what is collected and why
- collect only what a feature uses
- delete on request
- no republishing of Meetup attendee names (§5.5)
- identifiable photos only with consent (§5.2)

**Cookies.** With only functional cookies (sign-in) and an analytics tool that sets no cookies, the site should not need a consent banner.

**Running it.** Hosted services over a server someone has to maintain. Every recurring manual step is written down here so another host can take over.

---

## 7. Phases

| Phase | Scope | Sign-in |
|---|---|---|
| **1a — Launch, 10 October 2026** | Agenda with its own calendar feed (5.1) · About page with the Meetup link (the WhatsApp invite stays off the site, §8) | None needed; Google sign-in arrived early, on 4 October, for the Film finder (§8) |
| **1b — right after launch** | Archive and backfill (5.2) · recommendation and screening-tip forms (5.3); all built, the forms on 4 October | The forms: Google sign-in (§8, 4 October) |
| **2** | Ratings and reviews (5.4) · recommendation votes · member picks in the cinema run (5.3) | Email links |
| **3 — if needed** | Special-event signups (5.5) · opt-in member events (5.6) | Email links |
| **Parked** | WhatsApp import · Meetup attendee sync · Meetup Pro | — |

---

## 8. Decisions and open questions

### Decided — 30 September 2026

| Topic | Decision |
|---|---|
| **Stack** | Astro on Cloudflare (§9). Paid options are welcome where they significantly improve the site; adopted so far: the Workers Paid plan. |
| **Builder** | The organizer plus a second host who can deploy and fix things, building with Claude. |
| **Event source** | The group's events page, for every upcoming event; the iCal feed as fallback (§4). |
| **Domain** | **afig.nl**, with **amsterdamfilmgroup.nl** forwarding to it. Neither had a registration record on 30 September; register both soon. |
| **Budget** | Paid options when a feature needs them. |
| **Launch** | Announce the name together with the site launch. The date was fixed on 1 October (below). |
| **Admins** | All hosts, through Cloudflare Access. *Since 4 October 2026: through a host role on their member account (§8).* |
| **Host descriptions** | Every host includes a short shared block of labeled lines: `Film starts:` · `Tickets:` · `Language:` · `Auditorium:`. The rest of the description stays free. The Event Guide format already has all four. |
| **WhatsApp** | The community's invite link stays off the public site; it is shared through Meetup and at events. |
| **Recommendations** | Shown without members' names. *Since 4 October 2026: not shown to members at all, only to the hosts (§5.3).* |
| **Ratings** | Public average plus short quotes with first names only. |
| **Member sign-in** | Email links, to be confirmed at phase 2 (see below). **Superseded 4 October 2026:** Google and email links, from now (below). |
| **Language** | English. |
| **Archive** | Backfill every past event since the start. |
| **Code** | Private repository. |

### Decided — 1 October 2026

| Topic | Decision |
|---|---|
| **Launch** | **10 October 2026**, the second anniversary, is firm. The site launches with the agenda, its calendar feed and the About page (phase 1a). The archive, the backfill and the forms follow right after (phase 1b, §7). |
| **Meetup terms** | Build as planned, and ask Meetup in writing for permission to show the group's own events (§4). If they refuse: Meetup Pro, or links only. |
| **Calendar feed** | The site's own `/calendar.ics` with every upcoming event, instead of Meetup's feed (§5.1). |
| **Registrar** | **mijn.host** for both domains: €4.99 a year each before VAT, the same price at renewal (TransIP renews at €16.50, Versio at €25.99). DNS on Cloudflare's free plan (§9). **Both registered on 1 October 2026**, in the organizer's name; renewal due 1 October 2027. |
| **Accounts** | GitHub (`JuanMaTP`) and Cloudflare are the organizer's own accounts. The second host is an admin on both from day one (Cloudflare Super Admin). This replaces the group-address rule of 30 September (§9). |
| **Visual identity** | Direction *Fig dot*: the AFiG wordmark in Figtree with a small fig as the dot on the *i*, and a fig cut in half as the icon (`docs/brand/design-direction.md`). **Pronounced "a-fig"**, like the fruit. The palette stays. **Logo finished the same day:** a large fig dot in Fig, Figtree SemiBold, the four-layer icon at every size (favicon included), and the profile picture on Pith for now. Files in `docs/brand/logo/`. |
| **Stack review** | The stack stays. §9 now carries the corrections and additions from the review against current documentation. |
| **Engineering practices** | Written down in `docs/engineering.md`. **Launch first:** until 10 October only the launch-mode rules apply, chosen so the later clean-up stays cheap; linting, CI, dependency updates and the rest follow after launch. Only the organizer writes code, with Claude, and only the organizer commits: Claude never commits or pushes (enforced in `.claude/settings.json`). Short branches with a preview, squash-merged; Conventional Commits. |

### Decided — 2 October 2026

| Topic | Decision |
|---|---|
| **Screening details** | The film start, language, auditorium, ticket link and format are read from the event's title and description **when a page renders**, not stored by the ingest. A parser fix then reaches every event at once; stored readings would stay wrong for every event whose content hash hasn't changed. TMDB matching stays in the ingest, since it needs the network (§9). |
| **Calendar feed** | Keeps the past 30 days as well as every upcoming event, so attended screenings stay in subscribers' calendars (§5.1). |
| **Going public** | The site goes public on afig.nl **as soon as it is deployed**, before the AFiG announcement on 10 October, instead of with it. Text outside the site still says "Amsterdam Film Group" until the announcement. This replaces the 30 September order of announcing the name and opening the site together. |
| **Header and theme** | The header stays on top as a slim bar once the page scrolls (logo and nav, no subline), and a "back to top" button appears after one screen. Daylight or Screening room still follows the phone, but a footer switch (Auto · Light · Dark) overrides it, remembered in the browser's `localStorage`: a setting the visitor asked for, so no consent needed (§6, Cookies). Details in `docs/brand/design-direction.md`. |
| **Next feature** | Screening search and the watchlist check (§5.7). The source and the phase are still open (below). |
| **Film identity** | Every film has the site's own id (`films.id`), and everything else points to it: events, screenings, watchlists, ratings, recommendations. **TMDB is the source of film data, and its id is the film's identity,** stored with its kind (film or series: TMDB numbers them separately, §4), unique together. **The IMDb id is a unique cross-reference**, the key the catalogues share. A film needs at least one of the two, so a watchlist title TMDB doesn't have yet still gets a row, from the member's own export, and is completed when TMDB adds it. IMDb's own data is never used, and Wikidata is at most an extra cross-reference later (§4). Films are added as they are needed, never the whole catalogue (§9, Tables). With its own ids, a merge at TMDB or IMDb changes one row, not every reference, and the site depends on neither catalogue. |
| **Stack for the screening search** | The stack stays. The cinemas are read by a **second Cron Trigger, once a day**, in the same Worker; when the reads outgrow one run, they move to **Cloudflare Workflows**, with personal data kept out of it. Cinemas that need a browser come later, through Browser Run; a GitHub Action with Playwright is plan B. **`linkedom`** is approved as the HTML parser. Search stays in D1, watchlist matching in the browser, member sign-in with Better Auth. No new paid service (§9, Cinema reads). |

### Decided — 3 October 2026

| Topic | Decision |
|---|---|
| **Logo intro** | The site opens with the logo building itself (the reel spins in, the film strip unrolls, the name comes in), about 3.5 s, **once per browser session**, skippable with a tap or key, never with reduced motion or without JavaScript; the page renders underneath meanwhile. Chosen over a header-only gesture: the organizer judges the wait small. Details in `docs/brand/design-direction.md` ("Keep it mild"). |
| **Logo and palette** | The logo keeps its design (the fig dot on the *i*, the fig cut in half with its seeds as the holes of a film reel) and moves to **navy and red**. The fig is wider, halfway between the first drop and a wide fig, with a thicker skin, round red flesh and five larger, light holes; its stalk is a green strip of film bending over in an S. A **small version** (no ring, hub or stalk) serves 16 and 32 px, a **one-colour version** serves print, and on dark grounds the skin turns Pith. The site's header switches with the mode; where we don't control the background (profile picture, favicon) the icon sits on its own navy ground, always the same. The wordmark moves to Figtree **ExtraBold (800)**, its fig dot repeating the icon's outline. The **profile picture** is the icon in Pith on navy. The site's palette follows: Ink and Night become navy-black (`#1A1F3A`, `#10142B`), buttons and links take a darker red in Daylight and Coral in Screening room, all checked against WCAG AA. This replaces the 1 October choices of the palette, Figtree SemiBold, the four-layer icon at every size and the profile picture on Pith. Details in `docs/brand/design-direction.md`; how it was reached in `docs/brand/logo-exploration.md`. |
| **Ratings from Meetup** | The archive shows the **group's average event rating** from Meetup, which is public (the group page and the events page carry it; Meetup's feedback page says "Group reviews are public"). **Per-event ratings are not used for now:** Meetup shows them only on the organizer's feedback overview, behind a login, so the cron can't read them; and in the 80 reviews checked on 3 October, almost every event stood at 5.0 from 1 to 8 ratings, which tells events apart too little. Reviewers' names and comments are never copied to the site. The group's own ratings and reviews stay phase 2 (§5.4). |
| **Film matching for events** | A TMDB film is an event's film only when TMDB's own record agrees with the event on three things: **the title** (one of the event's titles, squashed to letters and digits, equals TMDB's title, original title or an alternative title), **the director** (one of TMDB's directors is named in the `Directed by` line) and **the year** when the event states one (the same, or one off). Exactly one film must agree; when two do, the one with the very year stated wins, and otherwise there is no match. An event without a `Year:` line can still match on title and director, since both must agree and a director's remake of their own film then comes out as two candidates and no match. The titles searched are `EK`'s, the title without its brackets, and that title without an occasion added after it (", Re-release in IMAX", "& 1,000 Member Celebration", "45th Anniversary"). **Checked against live TMDB for all 205 stored events:** 188 matched and every match was the right film; 10 have no director in the description, and 7 don't agree with TMDB (a misspelt title or director, a year or director that differs from TMDB's). |
| **TMDB account and key** | The organizer's own account, which already existed, like GitHub, Cloudflare and the domains. The key was granted the same day on TMDB's free **Developer plan**, declared non-commercial (§4, TMDB). **So the site earns no money while it uses TMDB:** ads, sponsorship, ticket sales or affiliate links need a commercial agreement with TMDB first, and phase 3's paid signups (§5.5) are checked against this before they are built. The site uses the **API Read Access Token**, sent in a header and never in a URL, as the secret `TMDB_TOKEN` (§9); the v3 API key isn't used. If the organizer is unavailable, another host requests a key with their own TMDB account and replaces the secret, so no login has to be shared. |

### Decided — 4 October 2026

| Topic | Decision |
|---|---|
| **Member sign-in** | Starts now, before phase 2, with **Google** and then **email links through Brevo** (EU), on **Better Auth** 1.7.7 with D1 (§9). Apple is left out: it needs Apple Developer ($99 a year) and a key renewed by hand every 6 months. Built 4 October: the tables `users`, `sessions`, `accounts` and `verifications` (migration `0008`), `/sign-in` (a plain form, no JavaScript), sign-out, sessions of 90 days, no IP addresses kept. `/sign-in` says what is kept and how to have it deleted (§6); a full privacy notice and deleting an account from the site come after launch. |
| **Screening search** | **Live for members who sign in**, while it is tried out: `/films` and `/films/<TMDB id>` send anyone without a session to `/sign-in` and back. **In the menu as the Film finder**, with a small lock while signed out. The first feature that uses accounts after it is the **watchlist kept on the site** (§5.7). |
| **Navigation and account** | **Two kinds of entry in the header:** the group's events are one, **Events**, with three views under its heading (**Upcoming** `/`, **Calendar** `/calendar`, **Past** `/past`), which replace *Upcoming · Past* in the header and *List · Month* on the agenda; each feature of the site is an entry of its own, the **Film finder** first (the screening search, §5.7). **About** joined on 4 October. On phones, two rows that fold to the 52 px slim bar on scroll; from 600 px, one row. Signed out, "Sign in"; signed in, the member's initial opens a menu with name, email and Sign out. No profile pictures: the Google picture isn't stored. When the features outgrow the header, a sidebar that adapts to the screen is proposed, to decide then. Details and the options rejected: `docs/brand/design-direction.md`, Navigation and account. |
| **Deploy of 4 October** | Found while deploying: production had never received migration `0005` (films and the cinema index) nor any secret, `TMDB_TOKEN` included, so film matching and the cinema run had not reached afig.nl. Applied `0005`–`0008`, set `TMDB_TOKEN`, `BETTER_AUTH_SECRET` (its own, not the local one), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and deployed. **The cinema index was copied once from a local read** (3 October, 20:35: 369 films, 503 film pages, 1,306 screenings, twelve cinemas), so the Film finder works before the first daily run in production; that run replaces it cinema by cinema. |
| **Recommendations need sign-in** | The recommendation and screening-tip forms (§5.3) are for **members who sign in**, not open forms with Turnstile as planned: sign-in stops spam, tells the hosts who sent what, and lets them reply. ~~The group's list shows films and how many members recommend each.~~ **Only the hosts see recommendations** (the organizer, the same day: a list members can see would sway them, or put them off recommending); each member sees their own. The hosts' list puts the most recommended first. |
| **Hosts are members with a host role** | Hosts sign in like any member; the secret **`HOST_EMAILS`** (their sign-in emails, separated by commas; locally in `.dev.vars`) makes them hosts, if the provider verified the email. Kept out of the repository, like any personal data. Replaces Cloudflare Access on `/admin` (§9, Admin security): one sign-in for everything, nothing more to set up. Every host page, endpoint and Action checks the role on the server and answers 404 to anyone else. The area is `/hosts`, reached from the account menu (§5.9). |
| **Privacy notice and sign-in fixes** | From a legal and rules check of the live site the same day. **`/privacy`**, linked from the footer, `/sign-in`, About and Google's consent screen (which since then lists `https://afig.nl` and `https://afig.nl/privacy`): the controller is the organizer, **Juan Mauricio Torres Perez**, with his email; what Cloudflare sees and its 7-day logs; images loaded from Meetup and TMDB; what sign-in keeps and its cookies; what the hosts see of a recommendation; the legal basis (Art. 6(1)(b), the logs 6(1)(f)); the EU database and the transfers to the US; accounts deleted 24 months after last use (the cron's purge still to build); the rights and the Autoriteit Persoonsgegevens; sign-in from 16. **Sign-in keeps no Google tokens and no user agent** (`databaseHooks` in `src/lib/auth.ts`, tested in `test/workers/auth.test.ts`); the rows stored before need clearing once in production. **`safeNext` refuses tabs, line breaks and backslashes**, which let `/sign-in?next=/%09/evil.example` send a member to another site after signing in; the sign-in origin is always https outside localhost; `preview_urls` is off. Still to do in the Cloudflare dashboard: *Always Use HTTPS*. |
| **Navigation by category: a sidebar and a Menu** | Replaces the header's tabs, the same evening, before it was deployed (the organizer: more will come, and each feature must say clearly which category it belongs to; host features live together). **Three categories**, listed once in `src/lib/navigation.ts`: **The group** (Events, About), **Tools** for members who sign in (Film finder, Recommend; later the watchlist) and **Hosts**, shown to hosts only (Overview, Screening tips, Recommended films; later every host tool, §5.9). On screens of 960 px and up a sidebar holds them, with the account at its foot; on phones and tablets a top bar with the logo and a **Menu** that opens the same list. Chosen over dropdowns in the header and over tabs plus a Menu. A row of tabs that slid sideways on narrow phones was built earlier that day and replaced. Details: `docs/brand/design-direction.md`, Navigation and account. |

### Still open

- **Before the 10 October launch:** ~~the About page~~ built 4 October 2026 (`/about`, in the header): how an evening works, what we watch, the name's story, how to join (Meetup; the WhatsApp invite stays off the site), the site's sources with TMDB's attribution, and a short privacy section that `/sign-in` links to. To review with the hosts before the launch.
- **Setup left after going live (3 October 2026):**
  - **www.afig.nl** has no DNS record yet. It needs a proxied placeholder `A www 192.0.2.1` and a Redirect Rule in the afig.nl zone: *Hostname equals www.afig.nl* → 301 to `concat("https://afig.nl", http.request.uri.path)`, query string kept. amsterdamfilmgroup.nl already redirects, every path and `www` included.
  - **DNSSEC** on both zones: turn it on in Cloudflare, then enter the key in mijn.host's *Manage keys*.
  - **Workers Builds** (from then on, `main` is production), **Healthchecks.io** for the cron, **Cloudflare Web Analytics**.
  - The **second host** as Super Admin on Cloudflare (§9, Accounts).
- ~~**Title parser:** a format in curly brackets isn't recognised~~ Fixed 4 October 2026: a group in curly braces is read as plain brackets, so "In the Mood for Love {4K Restoration (Cantonese w/ English Subtitles)}" shows the format and the language apart.
- **Meetup's answer** on showing the group's events (§4).
- **Account for the email provider (Brevo, chosen 4 October 2026):** the organizer's own, like GitHub, Cloudflare, the domains and TMDB, or a group address. Either way at least two hosts have access.
- **Brief the other hosts** on the shared block.
- **Host tools** (§5.9): the next ones, after the tips and recommended films (built 4 October 2026). How hosts sign in is decided: a host role on their member account (§8).
- **Member sign-in at phase 2:** email links, or *log in with Meetup* through Meetup Pro (§9, Paid options). The organizer is also considering OAuth (Google, Apple), which Better Auth supports, so that members can keep a watchlist on the site (§5.7).
- **Email provider at phase 2:** Resend keeps account data in the US even when it sends from Ireland; Brevo and Scaleway keep it in the EU (§9).
- **Cinema-run connection:** how the member watchlist reaches the run, and how the run's matches reach the site.
- **Social handles** for AFiG.
- **Screening search and watchlist check** (§5.7): the source (each cinema's own site, as the cinema run reads them; Filmladder only as a safety net, and only with its permission); which venues first (seven proposed, their terms checked on 3 October 2026; whether to ask MoHa, for FilmHallen and The Movies, and Kriterion first) and which after, each after its terms and `robots.txt`; the phase, before or after the launch; and what counts as a confident match when a cinema gives no director or no year. Also: the run's companion `AFG-CinemaTracking.md` still has to be copied into `docs/context/`, and a real IMDb export checked for its columns.
- **Shareable event image** (§5.8): its phase; who exports it (hosts in admin, or anyone from the event page); its sizes (WhatsApp, Instagram); and how it is rendered, which probably means a new dependency and so needs the organizer's OK.
- **Engineering decisions left for after launch** (`docs/engineering.md`, Open): GitHub Pro to protect `main`, Node 24 on both computers, retention periods for form data (before phase 1b).

---

## 9. Stack and architecture — decided 30 September 2026, reviewed 1 October 2026

Researched and decided 30 September 2026. Reviewed on 1 October 2026 against current documentation: the stack stays, and the limits below are the Workers Paid plan's. The organizer and a second host build and maintain the site with Claude. Paid options are welcome where they significantly improve the site; see Paid options below.

### The stack: Astro on Cloudflare

| Layer | Choice | Why, with the limits that matter |
|---|---|---|
| Framework | **Astro 7.3.x** with **`@astrojs/cloudflare` 14.x**, TypeScript | Content-first: ships little JavaScript, so pages are fast on phones, and server-renders where data changes. Owned by Cloudflare since January 2026, still open source and deployable elsewhere. Since Astro 6 the dev server runs on Cloudflare's runtime, so the database works locally too. **Pin both:** adapter 15 entered beta on 1 October 2026. Follow docs.astro.build; Cloudflare's own Astro guide still shows the setup from before adapter 13. |
| Hosting | **Cloudflare Workers** with static assets, on the **Workers Paid plan** | $5 a month, with 10 million requests and 30 million CPU milliseconds a month included. Requests for static assets are free and unlimited. A request may use 30 s of CPU (up to 5 min with `limits.cpu_ms`) and make 10,000 external requests, against 50 on the free plan. |
| Database | **Cloudflare D1** (SQLite), created with `--jurisdiction=eu` | 10 GB per database; 25 billion rows read and 50 million written a month, and 5 GB of storage, included. Never pauses. The EU jurisdiction keeps the data in the EU and **can only be set when the database is created** (confirmed 1 October 2026). Time Travel restores to any point in the last 30 days. Previews get their own database, also in the EU (Code and deploys, below). |
| Feed polling | **Cron Triggers**, in the same Worker as Astro | A `src/worker.ts` exports the adapter's `handle()` as `fetch` beside `scheduled()`; this is the adapter's documented custom entrypoint. A schedule more often than hourly gets 30 s of CPU per run (hourly or slower: 15 min); parsing the events page takes about 1 ms. Crons run in production only, never in previews. **A second trigger, once a day, reads the cinemas** (§5.7; Cinema reads, below), so it gets the 15 minutes; `scheduled()` tells the two apart by `controller.cron`. |
| Data access | **Drizzle ORM** 0.45 | Typed tables. `drizzle-kit generate` writes the SQL and `wrangler d1 migrations apply` runs it; use only that one migrator. **Check every generated migration that rebuilds a table:** D1 enforces foreign keys, and the rebuild silently deletes child rows (Drizzle issue #5782, open on 1 October 2026). Replace its `PRAGMA foreign_keys=OFF` with `PRAGMA defer_foreign_keys = on`. Drizzle 1.0 is still a release candidate. Also supports Postgres, so a move is a schema port rather than a rewrite. |
| Forms | **Plain HTML forms posted to their own page** (on demand), for members who sign in; **Astro Actions** + **Cloudflare Turnstile** for a form open to visitors | The recommendation and tip forms (4 October 2026) post to the page that shows them, which checks the session, saves and redirects (Post/Redirect/Get); no JavaScript, and Astro's origin check refuses posts from other sites. Turnstile loads its own script and stops spam without puzzles and without a login, for a form without sign-in (the email link's request, phase 2). Free. Set `session: false` unless a form result must survive a redirect: sessions need a KV store. |
| Admin | **A host role on the member account** (`HOST_EMAILS`), for the host tools at `afig.nl/hosts` (decided 4 October 2026, §8) | Hosts sign in like members; no second sign-in. Every host page, endpoint and Action checks the role itself (see Admin security, below). Replaces the plan of **Cloudflare Access** on `/admin` (free up to 50 users, a one-time PIN by email), which stays the fallback if a host can't use the member sign-in. |
| Member sign-in (phase 2) | **Better Auth** 1.7.7 or later, magic-link plugin, optionally Google | Through its Drizzle adapter, its tables live in the app's schema and migrations. It talks to D1 directly. 1.7.7 (30 September 2026) fixes a critical magic-link account takeover (GHSA-965c-763c-88jm). Create one instance per request; needs `nodejs_compat`. Long sessions, so members sign in rarely. |
| Email (phase 2) | **Chosen at phase 2** | Resend's free plan sends 3,000 emails a month, 100 a day. Its Ireland region sends from the EU, but account data, logs and metadata stay in the US. Brevo (300 a day free) and Scaleway (300 a month free) keep data in the EU. Cloudflare's own Email Service is in beta, on the paid plan, with 3,000 a month included and no EU residency statement. |
| Film data | **TMDB API** | Free for non-commercial use with attribution (§4). Images are requested at the size shown (`/t/p/w342/…`) and used as plain `<img>`, so no image transformations are needed. Rows refreshed before six months (§4). |
| HTML parsing | **linkedom**, with the first cinema reader (§5.7) | Approved 2 October 2026. Plain JavaScript: it runs in Workers and in the Node tests, and its DOM (`querySelectorAll`, `closest`, `textContent`) lets the cinema run's extractors carry over almost unchanged. Not Cloudflare's `HTMLRewriter`, which exists only in Workers. Pages that carry their screenings as JSON-LD (Kriterion) need no parser. |
| Fonts | **Self-hosted** with Astro's Fonts API | Stable since Astro 6. The build copies the font files into the site, so pages make no requests to Google. A German court fined a site for loading Google Fonts from Google (LG München I, 20 January 2022, 3 O 17493/20). The style tile in `docs/brand/` still loads them from Google, which is fine for a mockup. |
| Analytics | **Cloudflare Web Analytics** | Free. No cookies, no local storage, no fingerprinting. Its snippet goes in the Astro layout. The Autoriteit Persoonsgegevens says analytics with little or no privacy impact need no consent; the privacy notice mentions it. |
| Monitoring | **Healthchecks.io**, free plan | The cron pings it after each run, and it emails the hosts when the pings stop. Workers Logs (paid plan) keep 7 days. |
| Tests | **Vitest 4.1** + **`@cloudflare/vitest-plugin`** | The plugin (renamed from `vitest-pool-workers` in August 2026) supports Vitest 4.1 only, not Vitest 5. It runs the ingest, parsing and database code in Cloudflare's runtime, with the migrations applied. Pages and Actions are tested end to end against `astro preview`. |
| Code and deploys | **GitHub** + **Workers Builds** | Push to deploy. Paid plan: 6,000 build minutes a month. Other branches get a Worker Preview. **Previews don't inherit production bindings:** a D1 database missing from the `previews` block is simply absent, so the preview database (EU) is bound there (corrected 1 October 2026). With `workers_dev = false`, preview URLs need `preview_urls: true` or a preview-only custom domain behind Access. **Workers Builds deploys `main` whether or not GitHub checks pass**, so the build command runs the checks itself (`docs/engineering.md`). |

**Cost: $5 a month plus two domains** (about €12 a year for both at mijn.host, VAT included). The reason for the paid plan is requests, not CPU. Parsing the 165 KB events page takes about 1 ms, well inside the free plan's 10 ms. But the free plan allows 50 external requests per run, and the TMDB lookups and the backfill need more; the paid plan allows 10,000. It also brings 30-day Time Travel, Workers Logs and Cloudflare's own email sending (beta).

### Admin security

**Since 4 October 2026 hosts are members with a host role** (§8), not visitors let through by Cloudflare Access. So:

- **Every host page, endpoint and Action checks the role itself, on the server,** before it reads or writes anything: `Astro.locals.member()` (`src/middleware.ts`) gives the signed-in member with `host`, which is true only for a verified email on `HOST_EMAILS` (`src/lib/auth.ts`). Anyone else gets a 404, a visitor without a session the sign-in page. The layout (`src/layouts/Hosts.astro`) only frames the pages; it protects nothing.
- **Astro serves every Action at `/_actions/<name>`**, so a host Action, when there is one, checks the role itself as well; a page can't protect it.
- **Forms post to their own page**, which checks the role before acting on the post. Astro's origin check (`checkOrigin`, on by default) refuses a post from another site, so a host can't be tricked into hiding a film or closing a tip from a link elsewhere.
- **Host pages are rendered on demand**, never prerendered: middleware doesn't run for prerendered pages or static assets.
- **Close the side doors:** `workers_dev = false`; previews get their own D1, so their hosts can't touch production's data.

If Cloudflare Access is ever added (§9, Admin), its identity reaches a Worker with static assets only as the `Cf-Access-Jwt-Assertion` header, which the code must verify itself (with `jose`, against the team's certs), and its path must cover the bare `/hosts` as well as `/hosts/*`.

### How it fits together

```
Meetup events page ──cron, every 30 min──▶ ingest job ──▶ D1 ◀── TMDB API
(iCal feed as fallback)                                  ▲
Cinema sites ──cron, daily──▶ cinema reads (§5.7) ───────┘
                                                         │
Members (phones, from WhatsApp) ◀── Astro pages: agenda · event · archive · forms · films
Hosts ──sign-in + host role──▶ /hosts: tips · recommended films · (later) film matches · cinema reads
Cinema run ──reads──▶ member watchlist JSON   (phase 2)
```

**Ingest job**, every 30 minutes:

1. Fetch the **group's events page** and read its embedded event data: every upcoming event, with number going, RSVP limit and cover image. **Discard the embedded personal data** (attendees, creator, hosts). If the page can't be read or its structure has changed, fall back to the **iCal feed** (next 10 events) and flag it in admin. Never use the RSS feed or Meetup's internal API (§4).
2. **Skip entries whose content hasn't changed** (compare a hash). This keeps each run inside the CPU limit.
3. For new or changed entries: clean the title with **`EK` from `claude/AFG-Matcher.md`**, which already handles this group's event-title shapes, and look the film up on TMDB by **title, year and director** (§4). Map the venue through the `venues` aliases. **Accept only a confident match.** Otherwise the event shows no film details and admin flags it. A missing poster is fine; a wrong one is not. **Built 3 October 2026** (`src/lib/films/`, the rule in §8): after each Meetup read, up to 25 events whose content changed since their last match, nearest to today first, so the archive is matched over the first runs; the reason an event has no film is stored for admin. A TMDB failure stops the step and the events wait for the next run. The same step refreshes films older than 150 days. The screening details (film start, language, auditorium, ticket link, format) are not stored: they are read leniently (§4) from the title and description when a page renders (§8, 2 October 2026; `src/lib/details/`).
4. Upsert by Meetup event id. A future event missing from the events page is marked unlisted, not deleted. On the iCal fallback, only an event **dated inside the range the feed currently covers** can be judged missing: with a 10-event window, a later event drops out whenever an earlier one is added.
5. Ping the monitoring check, so a stopped cron gets noticed.

**First build step:** confirm a Worker can fetch the events page and the feed. Both loaded from a browser and from a server outside Cloudflare on 30 September. On 1 October the events page also answered a plain script (user agent `afig-website-check/0.1`) with the full page, 36 KB compressed. Meetup doesn't serve it through Cloudflare (no `cf-ray` header). The read itself is built (`src/lib/meetup/`, run by the cron, which stores what it read in D1). **Confirmed on Cloudflare on 2 October 2026:** the first cron run of the deployed Worker read the events page (not the feed) and stored all 14 upcoming events, with no problems, in 26 ms of CPU. Meetup doesn't block Cloudflare's network, so the GitHub Action fallback isn't needed. The iCal fallback hasn't been fetched from Cloudflare yet; it runs only when the events page fails.

**Cinema reads** (§5.7; decided 2 October 2026), once a day, on their own Cron Trigger:

1. For each cinema the site reads, check its `robots.txt` and `Crawl-delay`, then fetch the programme and, where the times live there, each film's page. One request at a time per site, about one every 2 seconds, with conditional requests (`ETag`, `If-Modified-Since`) and a User-Agent naming the site. Several sites are read at once: a Worker holds at most six connections waiting for an answer. Bot protection is never worked around (the run: Het Documentaire Paviljoen).
2. Read each page with that cinema's reader: a plain module, tested against the cinema's real page, trimmed. A version is kept only as the cinema states it.
3. Match each billed title to a film (§8, Film identity); confident matches only.
4. Store the cinema's screenings once its read is complete, in multi-row inserts (D1 allows 100 bound parameters per query and 1,000 queries per invocation). A cinema whose read fails keeps its last screenings, flagged in admin.
5. Record each cinema's counts. One that drops to zero, or far below its last read, is flagged: in the run's words, the counts are the health check. Ping the monitoring check.

**Limits and the way to grow.** A daily trigger gets 15 minutes of CPU and 15 of wall time. The seven first cinemas are about 450 pages; FilmHallen, the longest, is 149 pages, about 5 minutes at one every 2 seconds. When the reads outgrow one run (25 cinemas come to some 1,200 pages, with no room left for retries), they move to **Cloudflare Workflows**: one instance per cinema, one step per page with its own retries, pauses between requests, no wall-time limit, exported from `src/worker.ts` like any class. 500,000 steps a month are included; 25 cinemas a day need about 37,500. Only the orchestration changes, since the readers are plain modules. **Personal data never goes through Workflows:** it keeps each instance's state for 30 days, and Cloudflare documents no EU jurisdiction for it, unlike D1 (checked 2 October 2026). Cinemas that need a browser (Vue, Griffioen) come later, through **Browser Run**, each after a check that the endpoints its page calls allow robots (Cineville's don't: §5.7) (formerly Browser Rendering): 10 browser hours a month are included, against about 75 minutes needed for five cinemas. **Plan B**, as for Meetup: read the cinemas from a GitHub Action with Playwright (2,000 minutes a month included for private repositories) if they block Cloudflare's network or Browser Run doesn't serve. **First step**, as for Meetup: confirm from a deployed Worker that the cinemas answer Cloudflare's network.

**Pages** render from D1 on each request, with **no edge cache in phase 1**. Traffic is low, Cloudflare's Cache API doesn't work behind Access, and its new Workers Cache bills static-asset requests. Revisit if traffic grows. The calendar feed, `/calendar.ics`, renders from D1 the same way. Content pages (About, privacy notice) are Markdown in the repository. Every event page carries Open Graph tags with the film's backdrop, so a link shared in WhatsApp shows a proper preview.

**Tables:** `events` (Meetup id, title, meetup time, end, venue, number going, RSVP limit, cover image, raw description, film, status; the film start, auditorium, language and links are read from the title and description when a page renders) · `venues` (one row per real venue) with `venue_aliases` (every Meetup venue id that points to one; the 12 ids seen on 1 October 2026 are seeded by a migration, and an event whose id has no alias shows Meetup's venue name) · `films` (§8, Film identity: the site's own id, which every other table references; TMDB kind and id, unique together; IMDb id, unique; at least one of the two, as a `CHECK` in the schema; title, original title, year, director, runtime, images, last refreshed. A second TMDB entry claiming an IMDb id already stored is a TMDB duplicate: flagged in admin, never merged by guess) · `billed_films`, `screenings` and `cinema_reads` (built 3 October 2026, §5.7: each film page at a cinema with its film once matched, each screening still to come, each cinema's last read) · `recommended_films`, `recommendations` and `screening_tips` (built 4 October 2026, §5.3) · `users`, `sessions`, `accounts` and `verifications` (Better Auth, built 4 October 2026) · from phase 2: `ratings`, `votes`, `watchlist_items` (one row per member and film, the pair as primary key: the member, the film, when it was added and from where, such as an IMDb export or the site's own search).

**Cinema-run link (phase 2):** the site publishes the member watchlist as JSON (IMDb ids, titles, years and vote counts, no names) for the run to read as a third list. Matches come back through a paste box in admin.

### Set up once, hard to change later

- **Create D1 with the EU jurisdiction**, and the previews' database too. It can't be added afterwards. Until then `wrangler.jsonc` carries the placeholder id `not-created-yet`, so a deploy fails instead of creating the database: given a D1 binding without an id, `wrangler deploy` creates the database itself, with no jurisdiction (Wrangler 4.145, checked 1 October 2026).
- **Accounts** (decided 1 October 2026): GitHub (`JuanMaTP`) and Cloudflare are the organizer's own accounts, with the second host added as admin from day one (Cloudflare Super Admin). A volunteer site dies when the one person with the password leaves, so no account has a single admin. The domains are at mijn.host in the organizer's name. TMDB is the organizer's own account too (3 October 2026): the site needs only its key, which any host can replace with one of their own. The email provider is still open (§8).
- **Domains:** register both at mijn.host (§8), since Cloudflare Registrar doesn't sell `.nl`. Point their nameservers to Cloudflare (free plan) through a nameserver profile in mijn.host's control panel. mijn.host turns DNSSEC on by default and may switch it off when the nameservers change; check it, then turn DNSSEC on in Cloudflare and make sure the registrar holds Cloudflare's DS record. A DS record left over from the old nameservers stops the domain from resolving. **Done 2 October 2026:** both zones active on Cloudflare (nameservers `fiona` and `jose`); mijn.host withdrew the DS itself when the nameservers changed (its DNSSEC switch showed "Disabled" all along, so check the registry, e.g. `https://rdap.sidn.nl/domain/afig.nl`, not the switch). Cloudflare's import missed the MX and `_dmarc` records of amsterdamfilmgroup.nl; they were added by hand. The mijn.host mail records (MX, SPF, DMARC `p=reject`) stay on both domains. DNSSEC on Cloudflare is still to be turned on. amsterdamfilmgroup.nl forwards with placeholder proxied records for `@` and `www` (A `192.0.2.1`, AAAA `100::`) and a 301 Redirect Rule to `concat("https://afig.nl", http.request.uri.path)`.
- **Secrets** (the TMDB token as `TMDB_TOKEN`, later the email key) live in Cloudflare's secret store, never in the repository; locally, in `.dev.vars` on each computer, which git ignores.

### Paid options

| Option | Cost | What it adds | Verdict |
|---|---|---|---|
| Cloudflare Workers Paid | $5 a month | 10,000 external requests per run instead of 50; 30-day Time Travel; Workers Logs; Cloudflare's email sending (beta) | **Adopted** |
| Meetup Pro | From $55 per group a month; $47 on a 6-month plan | The official, documented API: every event, past ones included; *log in with Meetup* | **Not now.** The events page already gives every upcoming event, the number going and the cover images for free. Revisit if Meetup blocks the page read or refuses permission to show the events (§4), or at phase 2 if members should sign in with their Meetup account. |
| Resend Pro | $20 a month | More than 3,000 emails a month | Not needed at this size. |

### Alternatives considered

| Option | Why not here |
|---|---|
| Vercel + Supabase | Vercel's free plan runs scheduled jobs **at most once a day**, so the agenda could lag by a day. Supabase's free plan **pauses a project after a week of inactivity**, and its built-in email sends **2 messages an hour, to team members only**, so a separate email service is needed anyway. Supabase Pro starts at $25 a month. |
| Netlify | The free plan is 300 credits a month and **each production deploy costs 15**: about 20 deploys a month before anything else. |
| Static site + GitHub Actions | Cheapest for phase 1, but phase 2 needs a database anyway, and scheduled workflows in public repositories stop after 60 days without activity. |
| PocketBase on a small server | A good all-in-one with an admin screen, but someone has to keep a server patched and backed up. |
| WordPress | Familiar to non-developers, but paid hosting and plugin upkeep, and the custom parts (feed parsing, TMDB, the cinema run) become plugin work. |
| No-code builders (Webflow, Framer with Airtable) | Monthly fees, and reading the Meetup feed needs a paid automation tool on top. |

### Lock-in and the way out

Everything sits with one vendor; that is the main trade-off. Leaving stays cheap: Astro deploys to Node, Netlify or Vercel with a different adapter, D1 is SQLite and exports with one command (`wrangler d1 export`), and Drizzle supports Postgres. Keep the Cloudflare-specific code (bindings, Access, cron) in one small module.

---

## 10. Sources — checked 30 September 2026

- Meetup feeds: `https://www.meetup.com/amsterdam-film-group/events/ical/` · `https://www.meetup.com/amsterdam-film-group/events/rss/`
- Meetup API, Pro only: https://help.meetup.com/hc/en-us/articles/41467209211917 · eligibility: https://help.meetup.com/hc/en-us/articles/41453576628749 · data scope: https://help.meetup.com/hc/en-us/articles/41455194927373
- Meetup RSVP list download: https://help.meetup.com/hc/en-us/articles/39887158477965
- WhatsApp Groups API limits (third-party summary of Meta's documentation): https://www.unipile.com/whatsapp-group-api/
- TMDB terms and attribution: https://developer.themoviedb.org/docs/faq

Stack research (§9):

- Astro: acquisition by Cloudflare, 16 January 2026: https://secure.businesswire.com/news/home/20260116386991/en/Cloudflare-Acquires-Astro-to-Accelerate-the-Future-of-High-Performance-Web-Development · releases (7.3 on 3 September 2026): https://astro.build/rss.xml · Astro 6 dev server and Cloudflare bindings: https://bytes.dev/archives/469
- Cloudflare Workers limits: https://developers.cloudflare.com/workers/platform/limits/ · pricing: https://developers.cloudflare.com/workers/platform/pricing/ · Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/ · limits: https://developers.cloudflare.com/d1/platform/limits/ · data location: https://developers.cloudflare.com/d1/configuration/data-location/ · jurisdiction set at creation only: https://developers.cloudflare.com/changelog/2025-11-05-d1-jurisdiction/ · Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/
- Cloudflare Access for Workers: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ · one-time PIN: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/ · free plan: https://www.cloudflare.com/teams-access/
- Turnstile plans: https://developers.cloudflare.com/turnstile/plans/ · Web Analytics: https://www.cloudflare.com/web-analytics/ · Email Service (beta, paid plan): https://developers.cloudflare.com/email-service/
- Better Auth and D1: https://better-auth.com/docs/concepts/database
- Resend pricing: https://resend.com/pricing · regions: https://resend.com/docs/dashboard/domains/regions
- Supabase pricing: https://supabase.com/pricing · built-in email limits: https://supabase.com/docs/guides/auth/auth-smtp
- Vercel cron limits: https://vercel.com/docs/cron-jobs/usage-and-pricing · Netlify credits: https://www.netlify.com/changelog/netlify-pricing-update-introducing-credit-based-plans/
- GitHub scheduled workflows disabled after 60 days: https://docs.github.com/actions/managing-workflow-runs/disabling-and-enabling-a-workflow

Meetup events page, terms and Pro (§4, §9):

- Terms of Service (1 January 2026), §5.3(a) on reproducing the platform and §5.4 on scraping: https://help.meetup.com/hc/en-us/articles/360027447252-Terms-of-Service · robots.txt: https://www.meetup.com/robots.txt
- API licence terms: https://help.meetup.com/hc/articles/360028705532 · API sign-in flows: https://www.meetup.com/api/authentication/
- Meetup Pro pricing: https://help.meetup.com/hc/en-us/articles/39428296529421-Meetup-Pro-pricing-and-trial

Stack review, 1 October 2026 (§9):

- Astro Cloudflare adapter, including the custom entrypoint: https://docs.astro.build/en/guides/integrations-guide/cloudflare/ · changelog: https://github.com/withastro/astro/blob/main/packages/integrations/cloudflare/CHANGELOG.md
- Astro Actions: https://docs.astro.build/en/guides/actions/ · Fonts API: https://docs.astro.build/en/guides/fonts/
- Cron Triggers: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Drizzle table-rebuild cascade on D1: https://github.com/drizzle-team/drizzle-orm/issues/5782
- Better Auth magic-link advisory: https://github.com/advisories/GHSA-965c-763c-88jm
- TMDB API Terms of Use, §3 (attribution) and the six-month caching limit: last updated 20 October 2023
- Venue duplicates, `EK` checks and the 1 ms parse: measured on the live events page, 1 October 2026

Screening search and film identity, 2 October 2026 (§4, §5.7, §8):

- TMDB: API terms: https://www.themoviedb.org/api-terms-of-use · adding films (the contribution bible): https://www.themoviedb.org/bible/new_content · daily ID exports: https://developer.themoviedb.org/docs/daily-id-exports (files `movie_ids_10_01_2026.json.gz` and `tv_series_ids_10_01_2026.json.gz`, counted) · find by external id: https://developer.themoviedb.org/reference/find-by-id
- IMDb: Conditions of Use: https://www.imdb.com/conditions · robots.txt: https://www.imdb.com/robots.txt · Non-Commercial Datasets: https://data.imdb.com/non-commercial-datasets/ · their terms: https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX
- Letterboxd importer, columns and its TMDB data: https://letterboxd.com/about/importing-data/
- Wikidata: films with a TMDB id (property P4947) counted through https://query.wikidata.org/
- Filmladder: copyright and database right: https://www.filmladder.nl/auteursrecht · no API: https://www.filmladder.nl/techniek · robots.txt: https://www.filmladder.nl/robots.txt · the Amsterdam page, measured: https://www.filmladder.nl/amsterdam/bioscopen
- Cineville theatre pages (no `robots.txt`; showtimes loaded after the page): https://cineville.nl/nl-NL/theaters/eye
- The seven venues' programme pages and robots.txt: eyefilm.nl, lab111.nl, uitkijk.nl, kriterion.nl, filmhallen.nl, themovies.nl, studio-k.nu, read with a plain fetch
- Cinema reads (§9): Workers limits (Cron Triggers' CPU and wall time, subrequests, six simultaneous connections; updated 5 September 2026): https://developers.cloudflare.com/workers/platform/limits/ · Workflows limits: https://developers.cloudflare.com/workflows/reference/limits/ · pricing: https://developers.cloudflare.com/workflows/reference/pricing/ · testing: https://blog.cloudflare.com/better-testing-for-workflows/ · data localization (no Workflows entry): https://developers.cloudflare.com/data-localization/compatibility/ · Browser Run pricing: https://developers.cloudflare.com/browser-rendering/pricing/ · D1 limits: https://developers.cloudflare.com/d1/platform/limits/ · D1 and FTS5: https://developers.cloudflare.com/d1/sql-api/sql-statements/ · Astro's custom entrypoint with class exports: https://docs.astro.build/en/guides/integrations-guide/cloudflare/ · GitHub Actions minutes: https://docs.github.com/en/billing/concepts/product-billing/github-actions
