# Working setup: two computers and the Claude chat

Agreed approach, 1 October 2026. The website is worked on from three places: the Claude chat in the **Film Group** project (planning and decisions), and VS Code with the Claude Code extension on **this computer** and on the **MSI**.

## The principle: files carry the context, not chats

Each place keeps its own conversation history, and VS Code's history stays on the computer where it happened. The only thing all three can share is files. So every decision ends up in a file, never only in a chat.

## Where things live

| What | Home | Why |
|---|---|---|
| Code, `CLAUDE.md`, `docs/website-plan.md` | **Private GitHub repository** (this folder becomes it) | Both computers clone it; Claude Code reads `CLAUDE.md` at the start of every session |
| Group-wide docs (Core identity, Event Guide, Decisions, cinema tracking) | **Claude project "Film Group"** | Shared by all the group's chats |
| The website plan | **The repository**, `docs/website-plan.md` | The project's `claude/AFG-Website.md` becomes a one-line pointer once the repo exists, so there is never a second copy drifting |

- **Add the repository to the Film Group project** with claude.ai's GitHub integration (Project knowledge, then **+**, then **GitHub**). The chat can then read the current plan and code. It is read-only; press **Sync** to refresh.
- The chat session is linked to the **MSI**. If the repository folder there is connected to the chat, Claude can edit the plan from the chat while the MSI is on; you review and commit it. When it's off, the chat hands you the exact change to make.

## Set up each computer once

1. **Git**, signed in to GitHub (GitHub Desktop or `gh auth login`).
2. **VS Code** 1.94 or later, plus the **Claude Code** extension, signed in with your Claude account. To use `claude` in a terminal as well, install the standalone CLI.
3. **Clone** the repository: `https://github.com/JuanMaTP/afig-website`. If git on that computer signs in to GitHub with another account (a work account, say), make this repository alone use `gh`'s login as `JuanMaTP`. Run inside the clone:
   ```
   git config --local credential.https://github.com.helper ""
   git config --local --add credential.https://github.com.helper "!gh auth git-credential"
   ```
   Use the full path to `gh.exe` in quotes if `gh` is not on the PATH. `git ls-remote origin` then confirms access. Already set on the computer the repository was created on (1 October 2026); the MSI still needs it if it has the same conflict.
4. **Claude Code's own settings**, in `~/.claude/settings.json` on that computer (they never travel with the repository):
   - `"permissions": { "defaultMode": "auto" }`: Claude does routine work without asking. The repository's `.claude/settings.json` still makes deploys, secrets, remote database commands and `npm install` ask, and blocks commits and pushes.
   - `"model": "opus"`, without the `[1m]` suffix that the `/model` picker adds back.
   - Optional: `"language": "spanish"` to have Claude reply in Spanish. Everything in the repository stays English.
   - In VS Code, leave **Claude Code: Initial Permission Mode** on `default`, so the file above decides.

   Claude's memory and session notes also live in `~/.claude` on each computer. Anything that matters beyond one session goes into the repository.
5. Optional: VS Code **Settings Sync**, so both machines have the same extensions and settings.
6. When building starts: **Node.js** (for Astro) and **Wrangler** (Cloudflare's CLI), logged in to the site's Cloudflare account. The adapter needs Wrangler 4.125 or later; Worker Previews need 4.135 or later.

## Daily habit

- **Pull when you sit down. Commit and push before you switch computers.** Unpushed work on one machine is the main way things get lost. Once Workers Builds is connected, every push to `main` goes live, so push unfinished work to its branch (`docs/engineering.md`).
- **You commit, never Claude**, in VS Code on either computer and from the chat. Claude leaves its changes uncommitted for you to review, and can propose the commit message.
- **Write decisions into the files.** In VS Code, have Claude update `docs/website-plan.md` §8 or `CLAUDE.md` alongside the change, so both go in the same commit.
- **Use the chat for planning and decisions;** use VS Code for building.

## Which model for which task

Checked 3 October 2026 against Anthropic's system cards and independent boards (Design Arena, LMArena, Artificial Analysis, Vals.ai). Revisit when a new model ships; Haiku 5.5 is announced for the coming weeks.

| Task | Model and effort (`/model`, `/effort`) | Why |
|---|---|---|
| Features, CSS and UI on the site | Opus 5.5, `medium` (the default) | Leads SWE-bench Pro (89.9; Sonnet 5.5 and Fable 5.1 about 81) and LMArena WebDev (#1 overall) |
| Parsers, the ingest, the calendar: anything where a mistake reaches members | Opus 5.5, `high` | Anthropic's advice for work where verification matters or edge cases are likely |
| Logo, brand and visual design | Opus 5.5, `high` or `xhigh`; **never `max`** | Best Claude model on Design Arena's SVG board (#4 of 125, 1335; Fable 5.1 #9, 1308) and best at reading images without tools (Chartography 64.4 vs Fable 44.8). At `max`, Opus 5.5 and Sonnet 5.5 used up the 128K output limit on a simple SVG without answering |
| Architecture, hard debugging, long autonomous builds (the cinema readers) | Opus 5.5, `xhigh`; Fable 5.1 only when Opus falls short | Anthropic: start with Opus 5.5; Fable's edge is sessions that run for hours. Fable costs 2.5x per token, needs usage credits on Pro, and is capped at 50% of the weekly limit on Max |
| Web research, the plan and the docs | Opus 5.5 | Least likely to state a figure or source the inputs don't support (Anthropic) |
| Search subagents and mechanical bulk work | Sonnet 5.5 | Half the price, level with Opus 5.5 on Terminal-Bench (Vals.ai: 64.1% vs 65.2%) |
| Haiku 4.5 | Don't use | October 2025 model, far behind on every board |
| Fast mode (`/fast`) | Not needed | Bills to usage credits only |

**Design prompts.** Left undirected, Claude falls back on a house style: a cream background (around `#F4F1EA`), a serif such as Fraunces, a terracotta or amber accent, italic accent words, numbered "01/02/03" labels, pill-shaped buttons. AFiG's own Pith, Fraunces and Honey sit close to it, so when exploring a genuinely new direction, ban those patterns by name ("avoid a generic AI look" only swaps one default for another), and have Claude propose four distinct directions (background, accent, typeface, one-line rationale) before building one. No Claude model is the best tool for open-ended logo imagery: on the independent boards, image models lead the logo arena and a specialised vector model leads SVG. Claude's strengths are concepts grounded in the brand docs, precise SVG geometry, and critique of rendered drafts at real sizes (16 px, the circle crop, dark mode).

## Optional: carry one session to the other computer

Type `/remote-control` (or `/rc`) in the Claude Code panel in VS Code. You can then continue that session from a browser at claude.ai/code on the other computer, or from your phone; it keeps running on the first machine. Usually a fresh session is simpler, because `CLAUDE.md` and the plan bring the context along.

## Not for now

Claude Code's new cloud **Projects** (claude.ai/code) are not available in VS Code and can't see the Film Group chat project. Revisit later.

## Accounts

Per the decisions in `docs/website-plan.md` §8 (1 October 2026), **GitHub (`JuanMaTP`) and Cloudflare are the organizer's own accounts**. The second host is an admin on both from day one: a collaborator with admin rights on the repository, and a Super Admin on Cloudflare. The domains are registered at mijn.host in the organizer's name. TMDB is the organizer's own account too (3 October 2026); the site needs only its key, which any host can replace with one of their own. The phase 2 email provider is still open; whichever account it uses, at least two hosts have access.

## Sources

- Claude Code in VS Code: https://code.claude.com/docs/en/vs-code
- Remote Control: https://code.claude.com/docs/en/remote-control
- Claude Code Projects: https://code.claude.com/docs/en/claude-projects
- claude.ai GitHub integration: https://support.claude.com/en/articles/10167454-use-the-github-integration
- Model choice (3 October 2026): https://platform.claude.com/docs/en/about-claude/models/choosing-a-model · https://code.claude.com/docs/en/model-config · https://support.claude.com/en/articles/15424964-claude-fable-models-on-your-plan · system cards: https://anthropic.com/claude-opus-5-5-system-card, https://www.anthropic.com/claude-sonnet-5-5-system-card, https://www.anthropic.com/claude-fable-5-1-mythos-5-1-system-card · https://www.designarena.ai/leaderboard/svgs · https://arena.ai/leaderboard/code · https://www.vals.ai/benchmarks/terminal-bench-4 · https://simonwillison.net/2026/Sep/22/opus-and-sol-and-luna/
