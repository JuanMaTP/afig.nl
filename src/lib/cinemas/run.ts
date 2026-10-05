// The daily cinema run (plan §9, Cinema reads): read each cinema, store what a complete read found, then match
// the films whose details changed to TMDB. Cinemas are added here one at a time, each after a check of its
// terms and robots.txt (plan §5.7).
import type { Database } from '../db';
import type { Tmdb } from '../tmdb/client';
import type { CinemaReader } from './cinema';
import { cavia } from './cavia';
import { cinecenter } from './cinecenter';
import { eye } from './eye';
import { fcHyena } from './fc-hyena';
import { ketelhuis } from './ketelhuis';
import { lab111 } from './lab111';
import { melkweg } from './melkweg';
import { type Fetch, readCinema, type ReadOptions } from './read';
import { rialto } from './rialto';
import { type MatchSummary, matchBilledFilms, type StoredRead, storeCinemaRead } from './store';
import { studioK } from './studio-k';
import { thePulse } from './the-pulse';
import { uitkijk } from './uitkijk';
import { vlugt } from './vlugt';

export const CINEMAS: CinemaReader[] = [cavia, cinecenter, eye, fcHyena, ketelhuis, lab111, melkweg, rialto, studioK, thePulse, uitkijk, vlugt];

/** More than a day's new films at every cinema read so far; the rest wait for the next run. */
const FILMS_MATCHED_PER_RUN = 150;

export interface CinemaRunSummary {
  cinemas: Record<string, StoredRead>;
  films: MatchSummary | 'skipped: no TMDB token';
}

export async function runCinemas(
  db: Database,
  fetchFn: Fetch,
  tmdb: Tmdb | null,
  now: Date,
  options: ReadOptions = {},
): Promise<CinemaRunSummary> {
  // The cinemas are read at the same time, each at its own pace (one request at a time per site), so the run
  // takes as long as the slowest cinema, not their sum: a daily cron has 15 minutes (plan §9, Cinema reads).
  // One cinema's failure, even an unexpected one, never costs the others theirs: it is recorded as its read.
  const reads = await Promise.all(
    CINEMAS.map((reader) =>
      readCinema(reader, fetchFn, now, options).catch((error: unknown) => ({
        films: [],
        problems: [`unexpected: ${describe(error)}`],
        complete: false,
      })),
    ),
  );
  const cinemas: Record<string, StoredRead> = {};
  for (const [i, reader] of CINEMAS.entries()) {
    try {
      cinemas[reader.venueId] = await storeCinemaRead(db, reader.venueId, reads[i]!, now);
    } catch (error) {
      const failed = { films: [], problems: [...reads[i]!.problems, `storing: ${describe(error)}`], complete: false };
      cinemas[reader.venueId] = await storeCinemaRead(db, reader.venueId, failed, now);
    }
  }
  const films = tmdb ? await matchBilledFilms(db, tmdb, now, FILMS_MATCHED_PER_RUN) : 'skipped: no TMDB token';
  return { cinemas, films };
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
