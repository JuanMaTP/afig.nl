import { defineConfig } from 'drizzle-kit';

// Drizzle only writes the SQL; `wrangler d1 migrations apply` runs it (CLAUDE.md, D1 migrations).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/db/schema.ts',
  out: './migrations',
});
