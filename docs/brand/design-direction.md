# Design direction: the fig as seasoning, not decoration

**Status: decided 1 October 2026; logo and palette refined on 3 October 2026.** Proposed on 30 September and compared on 1 October with two alternatives (*Programme*, a serif wordmark without the fig, and *Inside the fig*, a fig with a cinema inside). The organizer chose this direction, *Fig dot*. **AFiG is pronounced "a-fig", like the fruit.** The logo was finished the same day. On 3 October it kept its design and moved to **navy and red**, with a shape that holds at 16 px and a dark version of its own (see "Logo files"); the site's palette moved with it (below).

- Comparison canvas (private on claude.ai until shared): https://claude.ai/artifact/DTWANnZmfV8t4JrRBQtuhi
- Also recorded in `docs/context/AFG-Decisions.md` §1 (Visual identity), a copy whose original lives in the Film Group project.
- First preview: `afig-style-tile.html` in this folder (still in the palette of 1 October).
- The refinement of 3 October, compared at real sizes (private on claude.ai until shared): https://claude.ai/artifact/KLfUA5Zz4GKDwbEimv9eXT

## Idea

A film club first, with the fig in a few small places only. The films bring the colour; the fig adds warmth and a name people remember. Story for the About page: **a fig flowers on the inside, like a cinema.** Botanically, the fig's flowers bloom inside the fruit.

## Where the fig appears (and nowhere else)

1. **Wordmark:** "AFiG" in Figtree, with a small fig as the dot on the lowercase *i*. It gives the lowercase *i* a reason to exist.
2. **Icon:** a fig cut in half, its seeds arranged like the holes of a film reel. For the WhatsApp community picture, the Meetup group photo and the favicon.
3. **Palette:** navy and red from the icon, with leaf and honey, and cream and navy-black as neutrals.

## Palette

| Name | Hex | Use |
|---|---|---|
| Pith | `#F6EFE3` | Light background (Daylight mode), pills, the pith ring in the icon |
| Paper | `#FFFBF5` | Cards in Daylight mode, the holes in the icon |
| Ink | `#1A1F3A` | Text in Daylight mode |
| Navy | `#1E2A5A` | Brand colour: the skin of the fig, the wordmark's letters, pill text, the still placeholder |
| Red | `#E5462F` | The logo's red: the flesh of the fig and the fig dot, in both modes. Never text: 3.9 on Paper |
| Brick | `#C23A24` | Buttons, links and "few places left" in Daylight mode (the logo's red, darker) |
| Coral | `#F2846C` | Buttons, links and "few places left" in Screening room mode |
| Honey | `#E7A64A` | Highlights in Screening room mode ("13 going") |
| Leaf | `#4F6B3C` | Stalks, positive states in Daylight mode |
| Night | `#10142B` | Dark background (Screening room mode) |
| Muted (light) | `#59607E` | Secondary text in Daylight mode |
| Muted (dark) | `#B9BED6` | Secondary text in Screening room mode |

**Contrast, checked against WCAG 2 on 3 October 2026 (AA needs 4.5:1 for normal text):** Ink on Pith 14.1 · Ink on Paper 15.7 · Muted on Pith 5.4, on Paper 6.0 · Paper on Brick 5.2 · Brick on Pith 4.7 · Navy on Pith 12.0 · Leaf on Paper 5.8 · Pith on Night 15.9 · Honey on Night 8.6 · Night on Coral 7.2 · Coral on Night 7.2. **Red is never used for text;** Daylight uses Brick and Screening room Coral.

**The logo's own contrasts** (graphics need 3:1): Navy skin on Pith 12.0 · Red flesh on Navy 3.4 · Paper holes on Red 3.9 · Pith skin on Night 15.9 · Red on Pith 3.5 · Night holes on Red 4.5 · the red fig dot on Pith 3.5, on Night 4.5.

**Screening room extras:** Leaf on Night `#8DAA6E` · card `#1A2040` · line `#2A3156` · film-still placeholder `#222A4E` · pill `#252C52` with text `#D9DEF5`. **Contrast checked 3 October 2026:** Pith on card 13.9 · Muted (dark) on card 8.6 · Honey on card 7.5 · Leaf on Night 7.0, on card 6.1 · pill text on pill 10.1 · Coral on card 6.3.

**On the agenda** (2 October 2026, colours of 3 October): "few places left" and "full" take Brick in Daylight (5.2 on Paper) and Coral in Screening room (6.3 on the card). The format tag on a still ("4K Restoration") is Pith on Night in Daylight and Night on Pith in Screening room (15.9 both). The header shows the wordmark inline, so the letters take Navy or Pith following the mode, and the fig dot stays Red. The icon is inline too, so it follows the site's mode, not only the phone's: on Pith its skin is Navy, its ring Pith and its holes Paper; on Night its skin is Pith, and the ring and holes take Night (tokens `--icon-skin`, `--icon-ring`, `--icon-flesh`, `--icon-hole` and `--wordmark` in `Base.astro`).

**The header on scroll** (2 October 2026; since 4 October the phone's top bar, Navigation and account below): it stays on top as a slim bar, 52 px: the icon at 30 px and the wordmark, without the subline, over a hairline in the line colour. At the top of the page it is the full header. A round "back to top" button (44 px, Paper or the dark card) appears at the bottom right once the page has scrolled more than a screen.

## Navigation and account

**Decided 4 October 2026**, when the screening search and member sign-in arrived; reorganised the same day by the organizer, and again that evening, when the header's tabs ran out of room: **a sidebar on wide screens and a Menu on phones, by category**. Checked in phone emulation at 320, 360 and 390 px, on a tablet (800 px), at 959 and 960 px and on a desktop, in both modes, signed out, as a member and as a host; no width scrolls sideways.

- **Every entry belongs to one category**, listed once in `src/lib/navigation.ts`, which the sidebar and the Menu both read. A new feature adds one entry to its category:
  - **The group:** what AFiG does as a community. **Events** (the events the hosts publish on Meetup) and **About**; later the group's ratings and member events.
  - **Tools:** what the site offers members who sign in. **Film finder** and **Recommend**; later the watchlist. While signed out each carries a small lock (and "members who sign in" for screen readers).
  - **Hosts:** everything for the hosts, in one place, shown to hosts only: **Overview**, **Screening tips**, **Recommended films**; later attendees, event information and the rest of plan §5.9. A count beside a tool says what waits (open tips, films recommended this week). Each page still checks the role itself (CLAUDE.md, Admin security).
- **Wide screens (960 px and up):** a sidebar of 264 px on the left, in view while the page scrolls: the logo, the categories as small capitals over their entries, and the account at its foot. There is no top bar, so the sticky day headings sit at the very top. The page stays **centred in the room beside the sidebar**, at the 760 px it has on its own.
- **The entries** (both the sidebar and the Menu): each has a line icon of its own (`src/components/NavIcon.astro`; Events a calendar, About an info mark, the Film finder a magnifier, Recommend a bulb, the hosts' Overview a grid, Screening tips a link, Recommended films a film strip), then its word, then the lock or the count at the far end, 40 px tall. The current page is a card with the accent at its left edge and on its icon. Categories are 24 px apart.
- **The account** at the foot: one card with the initial, the name and email (cut short with an ellipsis when long; the full text on hover) and Sign out as an icon button (its name for screen readers and on hover).
- **Phones and tablets:** a top bar with the logo and a **Menu** pill (icon and word: an icon alone is easy to miss). At the top of the page the bar is 64 px; once the page scrolls it slims to 52 px, the icon shrinks to 30 px and the subline folds. The Menu opens the same list over the page, below the bar, and the page stops scrolling behind it; it closes with Close, Escape, a tap on the bar, or when the screen widens into the sidebar. It is a `<details>`, so it works without JavaScript. A dot on the Menu tells a host that something waits.
- **Events has three views**, one switch under its heading: **Upcoming** (the list by day, `/`), **Calendar** (the month grids, `/calendar`; links to the old `/?view=month` redirect there) and **Past** (the archive, `/past`). A film's page in the Film finder keeps its own switch, **List · Calendar**, the same words. Views are a segmented control on the page; categories and entries live in the navigation.
- **Signed out:** the account's place holds **Sign in**, a full button, with "For the tools: the Film finder and Recommend." below it. It brings the visitor back to the page they were on.
- **Signed in:** the account card: the member's initial in a 32 px circle, in the wordmark's colours (Pith on Navy in Daylight, Night on Pith in Screening room), their name and email, and **Sign out**. Deleting an account will join it there.
- **No profile pictures:** a Google picture would be fetched from Google's servers on every page, which the site avoids even for fonts (plan §9), and the site keeps only what a feature uses (plan §6). So it isn't stored at all.
- **Before this** (4 October 2026, the same day): the header held the sections as underlined tabs, *Events · Film finder · Recommend · About*, with the account's initial opening a small menu, and hosts reached their tools from that menu, in an area with a sidebar of its own. With four entries the tabs no longer fit narrow phones; a row that slid sideways was built and then replaced, since every new feature would have made it longer and nothing said which category a feature belonged to.
- **Rejected:** dropdowns in the header, one per category (tools two taps away, and floating menus are fragile on phones); keeping the two most used entries as tabs beside the Menu (someone has to decide what is "most used", again and again); a bottom tab bar (it collides with Safari's toolbar and in-app browsers, the "back to top" button and the cards' buttons, and makes the site feel like an app).

## Type

- **Fraunces** (Google Fonts): a soft, warm serif with the feel of a printed cinema programme. For film titles and headings.
- **Figtree** (Google Fonts): clear and easy to read, for times, venues, buttons and the wordmark. It happens to be named after the fig tree.

## Two modes, following the phone's setting

- **Daylight:** cream background.
- **Screening room:** dark aubergine, for evening browsing.

A visitor can override the phone (2 October 2026): **Theme: Auto · Light · Dark** in the footer, Auto by default. The pick is kept in that browser only (`localStorage`), never sent anywhere. The footer, not the header, because on a phone the header has no room left: the subline already wraps at 360 px.

## Imagery

Film stills are the main imagery, never posters (Event Guide §8). Each event uses the host's own cover image from Meetup, with the TMDB backdrop as fallback.

## Keep it mild

- No fig illustrations scattered across pages.
- No fig puns in headings.
- The logo stays small; the films are the hero.
- **One exception: the intro** (decided 3 October 2026, `src/components/Intro.astro`). On the first page of a browser session the logo builds itself over the page for about 3.5 s: the red flesh appears, the reel spins in a full turn, the pith ring and the skin close around it, the film strip unrolls, the name is wiped in and the fig dot drops onto the *i*. Then it fades and the page, already rendered underneath, is there. A tap, click or key skips it. It never plays with reduced motion or without JavaScript, and not again in the same session (`sessionStorage`). It follows Daylight or Screening room through the site's tokens. The parts come from `marks.py` through `tools/intro.py`, which `export.py` runs (it writes `src/components/IntroMark.astro`). The organizer chose it over a header-only gesture, judging the wait small; if members find it slow, shorten it or drop to the gesture. Prototypes, the other concept (the fig opens with an iris) and the header gesture: https://claude.ai/artifact/W3QLJMrXfvYcZYJnEaNVvM

## Logo files

Finished on 1 October 2026 on the comparison canvas ("Refining A"), refined on 3 October 2026 (`logo-exploration.md`, and the comparison page linked at the top). The design is the same: the fig dot on the *i*, and the fig cut in half with its seeds set like the holes of a film reel.

- **Wordmark:** Figtree ExtraBold (800), drawn from the font's real outlines, so it never depends on a loaded font. Navy letters on light grounds, Pith on dark. The fig dot repeats the icon's outline, 215 font units tall (Figtree's own dot is 132), and is Red on every ground.
- **Icon, full version** (40 px and up: the header, lockups, profile picture): a fig halfway between the first tall drop and a wide fig, so the skin can be thick (5.2 in a 64-unit box). Three layers, as on 1 October (skin, a Pith ring, round red flesh), and five holes with a hub, like a film reel. The holes are light (Paper) instead of dark seeds, which is what makes them read as holes when small. **The stalk is a strip of film** in Leaf: it rises from the neck and bends over in an S, its sprocket holes cut out so the ground shows through. Below 64 px it reads as a curved stalk. The strip rises above the box, so the whole icon is drawn at 95 % to fit (`FIT` in `marks.py`). Three-layer variants that follow the fig's outline, and other places for the strip, were compared on 3 October (the page linked at the top).
- **Icon, small version** (16 and 32 px, and the favicon): skin, flesh and five larger holes; no ring, hub or stalk, since the outline's neck already makes the tip. The four-layer icon of 1 October turned into a pink drop at 16 px.
- **On dark grounds** navy disappears (1.3:1 on Night), so the skin turns Pith and the ring and holes take the ground's colour. The site's header switches with the mode: positive on light, reversed on dark, as most brands do.
- **Always the same, on its own navy ground,** where we don't control the background: the profile picture, `apple-touch-icon.png` and the **favicon**. A browser's tab strip can be light, dark or a theme's colour, and doesn't always follow the system's light or dark setting, so a favicon that switches with it can land navy on a dark tab. The favicon is the small icon at 92 % on a navy tile with rounded corners (`TILE` in `marks.py`). Checked 3 October on white, Chrome light and dark, Edge dark, and blue and purple themes. A light tile behind the logo in dark mode was considered and rejected: it glares like a sticker in a dark header.
- **One-colour version** (new): the fig in one ink, with the ring and holes cut out (transparent), for print in a single colour: stamps, shirts, screen print.
- **Profile picture:** the icon in Pith on a navy ground. In a list of chats it stands out more than a navy fig on Pith.

| File in `docs/brand/logo/` | For |
|---|---|
| `afig-lockup-horizontal` (+ `-dark`) | The site, email, documents |
| `afig-lockup-stacked` | Square posts, posters |
| `afig-wordmark` (+ `-dark`) | Where the icon is already shown |
| `afig-icon` (+ `-dark`) | The icon alone, transparent, 40 px and up |
| `afig-icon-small` (+ `-dark`) | The icon at 16 and 32 px |
| `afig-icon-mono` (Navy) and `afig-icon-mono-light` (Pith) | One-colour print |
| `afig-avatar.png` | WhatsApp community picture, Meetup group, link previews (1024 px, square; WhatsApp crops it to a circle) |

Each comes as SVG and PNG. The site's own icons are in `public/`: `favicon.svg` and `favicon.ico` (16, 32 and 48 px), both the small icon on its navy tile, `apple-touch-icon.png` and `afig-avatar.png` (the link preview image).

**To change or regenerate them:** the sizes and colours are constants at the top of `tools/marks.py`. Run `pip install -r docs/brand/tools/requirements.txt`, then `python docs/brand/tools/export.py` from the repository root; it writes `logo/` and the four files in `public/`. The header's inline icon and wordmark in `src/layouts/Base.astro` are copies of `afig-icon.svg` and `afig-wordmark.svg`, coloured by tokens, and are updated by hand. Figtree 2.002 is kept in `tools/fonts/` (SIL Open Font License), so a font update upstream cannot shift the logo.

## Open

- **Style tile:** its example card uses the real *Amores Perros* event (Eye, 11 October 2026) with RSVP numbers from 30 September.
