/// <reference types="@cloudflare/vitest-plugin/types" />

declare namespace Cloudflare {
  interface Env {
    /** The D1 migrations, read in vitest.config.ts and applied in setup.ts. */
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}
