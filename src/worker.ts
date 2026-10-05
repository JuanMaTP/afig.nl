// The Worker's entrypoint: Astro serves every request. Two crons (wrangler.jsonc): every 30 minutes the
// Meetup ingest and then film matching; once a day the cinema run (plan §9).
// Keep Cloudflare-specific wiring here and in small modules next to it (CLAUDE.md).
import { handle } from '@astrojs/cloudflare/handler';
import { database, tmdb } from './cloudflare';
import { runCinemas } from './lib/cinemas/run';
import { matchBilledFilms } from './lib/cinemas/store';
import { runFilms } from './lib/films/store';
import { runIngest } from './lib/ingest';

/** Must match the daily cron in wrangler.jsonc. */
const CINEMA_CRON = '15 4 * * *';
/** Cinema films matched by each 30-minute run, on top of the daily run's: D1 allows 1,000 queries an invocation. */
const BILLED_FILMS_PER_RUN = 30;

export default {
  async fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },

  async scheduled(controller, env, _ctx) {
    const db = database(env.DB);
    const fetchFn = (url: string, init: RequestInit) => fetch(url, init);
    const films = tmdb(env.TMDB_TOKEN, fetchFn);

    if (controller.cron === CINEMA_CRON) {
      const summary = await runCinemas(db, fetchFn, films, new Date());
      console.log(JSON.stringify({ cron: controller.cron, ...summary }));
      return;
    }

    const summary = await runIngest(db, fetchFn, new Date());
    console.log(JSON.stringify({ cron: controller.cron, ...summary }));
    // The secret `TMDB_TOKEN` (plan §8, TMDB account and key); without it the films wait.
    const matched = films ? await runFilms(db, films, new Date()) : 'skipped: no TMDB token';
    // The cinema films the daily run left unmatched, a few at a time (src/lib/cinemas/run.ts).
    const cinemaFilms = films ? await matchBilledFilms(db, films, new Date(), BILLED_FILMS_PER_RUN) : 'skipped: no TMDB token';
    console.log(JSON.stringify({ cron: controller.cron, films: matched, cinemaFilms }));
  },
} satisfies ExportedHandler<Env>;
