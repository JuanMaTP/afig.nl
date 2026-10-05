import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Plain modules (parsing, matching, formatting) run in Node.
        test: { name: 'unit', include: ['test/**/*.test.ts'], exclude: ['test/workers/**'] },
      },
      {
        // The ingest and D1 run in Cloudflare's runtime, with the migrations applied (docs/engineering.md, Tests).
        plugins: [
          cloudflareTest(async () => ({
            // src/worker.ts imports Astro's handler, which Vitest can't load.
            main: './test/workers/entry.ts',
            wrangler: { configPath: './wrangler.jsonc' },
            miniflare: { bindings: { TEST_MIGRATIONS: await readD1Migrations('./migrations') } },
          })),
        ],
        test: { name: 'workers', include: ['test/workers/**/*.test.ts'], setupFiles: ['./test/workers/setup.ts'] },
      },
    ],
  },
});
