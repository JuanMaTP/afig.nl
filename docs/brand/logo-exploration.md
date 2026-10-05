# Logo exploration, 2–3 October 2026

**Outcome:** the organizer keeps **today's logo design** (`design-direction.md`, "Logo files") and prefers the **navy and red palette** from the exploration. **Done the same day (3 October):** the logo was refined with these findings and moved to navy and red, and the site's palette with it. What was chosen is in `design-direction.md`, "Logo files" and "Palette"; the variants are compared at real sizes at https://claude.ai/artifact/KLfUA5Zz4GKDwbEimv9eXT (private until shared).

## How the exploration ran

1. **Model choice** (`docs/working-setup.md`, "Which model for which task"). Opus 5.5 at `high` effort, never `max`.
2. **Ideas from an image model:** ChatGPT's free plan, two concept sheets.
   - [Variations of today's logo](exploration/2026-10-02-chatgpt-variations.png) (2 October).
   - [Completely new directions](exploration/2026-10-03-chatgpt-new-directions.png) (3 October).

   ChatGPT wrote "Amsterdam Film **Club**" on the first sheet: it must be told the name is Amsterdam Film Group.
3. **Test at real sizes.** Each concept was cropped and rendered as follows.

   | Context | Sizes |
   |---|---|
   | WhatsApp circle crop | 96 px |
   | Icon sizes | 64, 32 and 16 px |
   | Night background | 32 and 16 px |

   Results: [variations](exploration/2026-10-03-size-test-variations.png) · [redrawn finalists](exploration/2026-10-03-finalists-size-test.png).
4. **Two finalists, redrawn as vectors** on a Claude Design canvas (private until shared): https://claude.ai/artifact/2aPAvU3yet5hBvd4zPF529
   - **A · Fig reel:** today's idea with bolder contrast.
   - **B · Flowering fig:** three variants (bloom, projector beam, reel stem).

## What the tests showed (use these when improving today's logo)

### Small sizes
- **Today's icon reads worst of all at 16 px.** Its six small seeds (r 2.4–2.6 in a 64-unit box), thin skin ring and four layers blur into a pink drop. The concepts that held up at 16 px (ChatGPT's 1, 4 and 5; finalist A) have three things in common:
  - **fewer, larger holes:** five around a hub, r 3.9 at radius 8.6 from the centre;
  - **a thicker skin;**
  - **two flat colours with strong contrast**, and no pith ring.

  A simplified icon for 16 and 32 px is normal practice. The design decision of 1 October, "the full four-layer fig at every size, the favicon included", is worth revisiting.

### Silhouette
- **Solid fills need a wider, rounder fig.** Today's fig outline is tall and narrow, so a solid fill reads as a drop or an onion. Finalist A uses this outline in the same 64-unit box, and it reads as a fig:

  ```
  M32 9 C35 9 36.5 13 39.5 16.5 C50 21 55 31 54 42 C53 54 43.5 61 32 61 C20.5 61 11 54 10 42 C9 31 14 21 24.5 16.5 C27.5 13 29 9 32 9 Z
  ```

### The navy and red palette, as tested
| Role | Hex |
|---|---|
| Skin | `#1E2A5A` |
| Flesh | `#E5462F` |
| Holes | `#FFFBF5` |
| Stalk | Leaf `#4F6B3C` |

ChatGPT's sheet also put the red on the fig dot of the *i*.
- **Checked on 3 October:** navy sinks into any dark ground (1.3:1 on Night), so the dark version has a Pith skin. `#E5462F` is 3.9 on Paper: fine for the drawing, too light for text, so the site uses a darker red (Brick) and Coral on dark (`design-direction.md`, "Palette").

### House style
- **Claude's house style.** Left undirected, Claude falls back on a cream background, a Fraunces-like serif and a terracotta or amber accent, and AFiG's Pith, Fraunces and Honey sit close to it. A move to navy and red also takes the brand further from that default.

### Concepts not chosen
| Concept | Strength | Weakness |
|---|---|---|
| Flowering fig, projector beam | The only flower variant that holds at 16 px | Not chosen |
| Bloom, reel stem | Attractive large | Blur when small |
| Hand-drawn | — | Fragile below 64 px |
| Monoline | — | Disappears at 16 px and on dark backgrounds |
| Flower in a circle | The best avatar | Loses the fig |
| Wordmark inside a yellow fig | — | Unreadable small |

## Where the logo lives

| What | Where |
|---|---|
| Generator | `tools/marks.py`: the constants for the fig body, stalk, seeds and colours are at the top |
| Export | `python docs/brand/tools/export.py`, from the repository root |
| Logo files | `logo/` |
| Site icons | `public/favicon.svg`, `favicon.ico`, `apple-touch-icon.png` and `afig-avatar.png` (written by `export.py`) |
| Header | the inline icon and wordmark in `src/layouts/Base.astro` |
| Palette | the tokens in `src/layouts/Base.astro`; the hex table in `design-direction.md` |
