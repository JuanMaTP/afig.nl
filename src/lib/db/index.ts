import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from './schema';

/** The app's database. Created in `src/cloudflare.ts`; everything else receives it as a parameter. */
export type Database = DrizzleD1Database<typeof schema>;
