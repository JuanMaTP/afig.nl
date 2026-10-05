# Engineering practices

**Agreed 1 October 2026.** How the site is built and kept running. Researched the same day against current documentation (sources at the end).

**Launch first.** Until the launch on 10 October 2026, only the rules in *Launch mode* apply. Everything after it is the target, applied once the site is live. Shortcuts are fine before launch; dead ends are not. The launch-mode rules are the ones that would be expensive to retrofit.

Only the organizer writes code, with Claude. Only the organizer commits, pushes and merges.

## Launch mode (until 10 October 2026)

1. **Keep logic out of the entrypoints.** `src/worker.ts`, pages and Actions only wire things together. Parsing, matching, the ingest and the calendar feed live in plain TypeScript modules with no Astro or Cloudflare imports. Tests can import those; importing `src/worker.ts` in Vitest fails.
2. **Cloudflare-specific code in one small module** (bindings, Access, cron), as `CLAUDE.md` already says.
3. **Validate external data where it enters**, with `astro/zod` (Zod 4, bundled with Astro). This applies to Meetup's `__NEXT_DATA__` and to TMDB responses. `z.object` drops unknown keys, so attendee, host and creator data never gets past the schema. A failed parse means the field is left out, never guessed.
4. **Schema changes only through Drizzle migrations** (`CLAUDE.md`, D1 migrations).
5. **Test what reaches members if it is wrong:** the description parser, the `EK` title cleaner, TMDB matching and `/calendar.ics`. Fixtures are real Meetup pages, trimmed, with every attendee, host and creator removed.
6. **Mark shortcuts** with `// TODO(after-launch): …`, so one search finds every one.
7. **No new dependency without the organizer's OK.** `.claude/settings.json` makes `npm install` ask.
8. **Git:** until the GitHub repository and Workers Builds exist, committing on `main` is fine. Once Workers Builds is connected, `main` is production: push branches, never `main`.

## Git and commits

- **Conventional Commits:** `type(scope): subject`, in the imperative and lowercase, at most 72 characters. The body explains why.
  - Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style`.
  - Scopes: `agenda`, `ingest`, `ics`, `about`, `admin`, `db`, `brand`, `claude`, `deps`.
- **Branches:** `<type>/<topic>`, short-lived, one change each, for example `feat/agenda` or `fix/ics-timezone`.
- **Pull requests:** one per branch, checked on its Worker Preview (on a phone too), then **squash-merged**. The PR title becomes the commit on `main`, so it is written as a Conventional Commit, and the PR body becomes the commit body. Commits on the branch can stay rough.
- **Claude never commits, pushes or merges.** `.claude/settings.json` denies those commands, and `.claude/hooks/block-git-writes.mjs` blocks them in every permission mode.
- **GitHub settings** once the repository exists:
  - allow squash merging only, with "pull request title and description" as the default message;
  - delete head branches automatically;
  - turn on Dependabot alerts and security updates.
- **GitHub Free can't protect `main` in a private repository** (no branch protection or rulesets, no secret scanning). The protection is the checks inside the Workers build (CI/CD) plus the habit. GitHub Pro would enforce it.

## Code quality (after launch)

- **Lint:**
  - ESLint 10 with `typescript-eslint` (`strictTypeChecked`), `eslint-plugin-astro` and `eslint-plugin-jsx-a11y-x`. The original `eslint-plugin-jsx-a11y` rejects ESLint 10.
  - Not Biome: its Astro support is still experimental, and it has no type-aware rules.
- **Format:** Prettier 3.9 with `prettier-plugin-astro`.
- **TypeScript:** `astro/tsconfigs/strictest`. `noUncheckedIndexedAccess` is the main gain for regex matches and scraped arrays. Drop `exactOptionalPropertyTypes` if it gets in the way. TypeScript 6 defaults `types` to `[]`, so add `@types/node`, and give the tests their own `test/tsconfig.json`. Stay on TypeScript 6.0.x: `typescript-eslint` and `@astrojs/check` don't support 7 yet.
- **Editor:** `.editorconfig` (LF, 2 spaces) and `.vscode/extensions.json` recommending Astro, ESLint, Prettier, EditorConfig and Vitest.
- **npm:**
  - `.npmrc` with `save-exact=true`, `engine-strict=true` and `min-release-age=7`, so nothing published in the last 7 days installs.
  - Approve install scripts explicitly: `npm install-scripts approve esbuild workerd`.
  - Commit `package-lock.json`; automation uses `npm ci` only.
- **Node:** `.node-version` set to `24`, the LTS that Workers Builds uses by default (24.18). Install the same version on both computers; Node 26 is not LTS.

## Tests

- **Vitest 4.1** + **`@cloudflare/vitest-plugin` 1.3**. The plugin doesn't support Vitest 5: block that upgrade.
- **Two projects:**
  - **workers:** the ingest, D1 and the cron in Cloudflare's runtime.
    - It needs its own test entry, because `src/worker.ts` imports Astro's handler.
    - Migrations are applied with `readD1Migrations` and `applyD1Migrations`.
    - `scheduled()` is tested with `createScheduledController` and `waitOnExecutionContext`.
  - **astro:** components through the Container API, with the Cloudflare adapter switched off when `process.env.VITEST` is set (withastro/astro#15878).
- **Fetch:** `fetchMock` is gone. Pass `fetch` in as a parameter, or use `vi.spyOn(globalThis, 'fetch')`.
- **Coverage:** `@vitest/coverage-istanbul`; the plugin doesn't support v8 coverage.
- **After launch:** a few Playwright + `@axe-core/playwright` smoke tests against `npm run preview`. Skip Lighthouse CI; Web Analytics already measures Core Web Vitals from real visits.

## CI/CD

- **Workers Builds**, production branch `main`:
  - **Build command:** `npm run check && npm test && npm run build`. Workers Builds doesn't wait for GitHub checks, so a failing check has to stop the build itself.
  - **Deploy command:** `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`. The build token probably needs D1 Edit; check when setting it up.
  - **Other branches:** `npx wrangler preview`.
  - **Watch paths:** leave out `docs/**`.
- **Previews:**
  - **Database:** previews don't inherit production bindings, so the preview D1 (EU) goes in the `previews` block. Its migrations are applied before the preview deploys.
  - **Crons** never run in previews.
  - **Preview URLs:** with `workers_dev = false`, set `preview_urls: true`, or use a preview-only custom domain behind Access.
- **Trailing slashes:** Workers static assets default to `html_handling: "auto-trailing-slash"`. Keep Astro's `trailingSlash` and `build.format` consistent with it (not yet checked).
- **GitHub Actions** (after launch):
  - Runs on pull requests and on `main`: `npm ci`, lint, `npm run check`, `npm test`, `npm run build`.
  - `permissions: contents: read`.
  - Actions pinned by full SHA, with a version comment.
- **Dependabot** (after launch):
  - Weekly, for npm and GitHub Actions.
  - Groups: Astro and `@astrojs/*`; wrangler and `@cloudflare/*`; Drizzle; Vitest.
  - Cooldown 7 days (majors 14), never shorter than `min-release-age`.
  - Ignore major versions of `@astrojs/cloudflare` and Vitest until the test plugin supports them.

## Operations

- **D1 migrations:**
  - Forward only. Never edit an applied migration.
  - Expand first and contract later, because a code rollback leaves the database as it is.
  - Before each remote migration, note the Time Travel bookmark: `npx wrangler d1 time-travel info DB`.
- **Backups:**
  - Time Travel covers 30 days.
  - Once a month, run `npx wrangler d1 export DB --remote --output=…` and store the file outside Cloudflare, encrypted once it holds emails.
  - Keep exports for at most 6 months: TMDB's terms limit how long its data is kept.
- **Rollback:** `npx wrangler rollback` (the last 100 versions; blocked if the D1 binding changed).
- **`compatibility_date`:** bump it once a quarter, in its own commit, after `npm test` and `npm run preview`.
- **Monitoring:**
  - **Healthchecks.io:** the cron pings `start`, then `success` or `fail`, with the same `rid`, inside `ctx.waitUntil`. Errors are caught so the `fail` ping always goes out. Period 30 minutes, grace 30 minutes.
  - **Workers Logs** keep 7 days (already on).
  - **Workers Issues** for error alerts.

## Security

- **CSP:** Astro's `security.csp` (a meta tag with hashes), allowing `challenges.cloudflare.com` (Turnstile) and `static.cloudflareinsights.com` (Web Analytics).
- **Other security headers:** frame protection, `nosniff` and `Referrer-Policy`, sent from middleware. `public/_headers` only covers static assets.
- **HSTS:** in the Cloudflare dashboard, starting with a short max-age.
- **Forms:**
  - Keep `security.checkOrigin` on (the default).
  - Verify Turnstile on the server: check `success`, `hostname` and `action`. Tokens work once, for 300 seconds.
- **Admin:** hosts are members with a host role (`HOST_EMAILS`, plan §8, 4 October 2026). Every host page, endpoint and Action checks `member.host` on the server before it reads or writes, and answers 404 to anyone else (`CLAUDE.md`, Admin security). If Cloudflare Access is ever added, its JWT is read from the header and checked with `jose` (`createRemoteJWKSet`, `jwtVerify`), with the team domain as issuer and the AUD tag as audience.
- **Secrets:** set with `wrangler secret put`. Keep a master copy in a password manager, because Cloudflare can't show a value after it is set.

## Privacy and accessibility

- **Privacy page at launch:**
  - It names Cloudflare Web Analytics, which uses no cookies, so no cookie banner is needed. The EDPB's view on scripts without cookies still needs a human check.
  - Turnstile and the forms are added before phase 1b.
  - Cloudflare's data processing agreement is part of its self-serve terms; there is nothing to sign.
- **Before the forms (phase 1b):**
  - Set retention periods. Proposal: screening tips deleted 90 days after the event; submitter details removed from recommendations after 12 months; phase 2 accounts deleted 24 months after the last sign-in; logs 7 days.
  - Keep a one-page processing register.
- **Accessibility:** target WCAG 2.2 AA. The European Accessibility Act very likely doesn't apply to a volunteer group with no turnover; check again before phase 2 sign-ups. Checklist:
  - tap targets at least 24 px;
  - a sticky header never hides keyboard focus;
  - text contrast at least 4.5:1;
  - the layout reflows at 320 px;
  - form fields have labels, and errors are written in text;
  - images have alt text;
  - `lang="en"`;
  - language and subtitles are shown as text, never only as icons.

## Maintenance calendar (after launch)

- **Weekly:** read the Healthchecks and Workers Issues alerts; merge Dependabot security PRs.
- **Monthly:** patch and minor updates within the pinned majors; D1 export.
- **Quarterly:**
  - bump `compatibility_date`;
  - review who is on `HOST_EMAILS`;
  - check that the cron refreshes `films` rows before they are six months old.
- **Yearly:**
  - restore a D1 export into a scratch database to prove the backups work;
  - rotate the TMDB key, the Turnstile secret and the build token;
  - review the privacy page;
  - upgrade Astro's major version while the old one still gets security fixes.
- **Domains:** auto-renew at mijn.host, with a reminder on 1 September 2027 for the renewal on 1 October 2027.
- **When a host leaves:** remove them from Cloudflare, `HOST_EMAILS` and GitHub, and rotate the secrets they could see.

## Open

- **GitHub Pro** to enforce protection of `main`: not for now; the Workers build checks are the safeguard.
- **Node 24 on both computers:** after launch.
- **Retention periods** for form data: before phase 1b.

## Sources (checked 1 October 2026)

- GitHub plans and rulesets: https://docs.github.com/en/get-started/learning-about-github/githubs-plans · https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- Squash merging: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/configuring-commit-squashing-for-pull-requests
- Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/configuration/ · build image: https://developers.cloudflare.com/workers/ci-cd/builds/build-image/ · previews: https://developers.cloudflare.com/workers/previews/configuration/
- Vitest integration: https://developers.cloudflare.com/workers/testing/vitest-integration/ · Astro testing: https://docs.astro.build/en/guides/testing/
- typescript-eslint versions: https://typescript-eslint.io/users/dependency-versions · eslint-plugin-astro: https://ota-meshi.github.io/eslint-plugin-astro/user-guide
- Dependabot options: https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference · npm config: https://docs.npmjs.com/cli/v11/using-npm/config
- D1 Time Travel: https://developers.cloudflare.com/d1/reference/time-travel/ · rollbacks: https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
- Healthchecks API: https://healthchecks.io/docs/http_api/ · Workers Issues: https://developers.cloudflare.com/workers/observability/issues/
- Astro configuration (CSP, checkOrigin): https://docs.astro.build/en/reference/configuration-reference/ · Turnstile validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- Dutch DPA on information duties and cookies: https://autoriteitpersoonsgegevens.nl/themas/basis-avg/privacyrechten-avg/recht-op-informatie · https://autoriteitpersoonsgegevens.nl/themas/internet-slimme-apparaten/cookies
- WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ · EAA scope: https://www.acm.nl/en/accessibility/accessibility-e-commerce-services-and-electronic-communications-services
