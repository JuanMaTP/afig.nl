// The D1 tables (plan §9, Tables). Change them only through Drizzle migrations: `npm run db:generate`,
// check the SQL, then `npm run db:migrate:local` (CLAUDE.md, D1 migrations).
import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Every film the site knows (plan §8, Film identity). Everything else points to `id`, the site's own.
 * TMDB is the identity and the source of the data, as kind and id; the IMDb id is a cross-reference.
 * A film needs at least one of the two. TMDB data is refreshed before it is six months old (plan §4).
 */
export const films = sqliteTable(
  'films',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** TMDB numbers films and series separately, so its id is only unique together with the kind. */
    tmdbKind: text('tmdb_kind', { enum: ['movie', 'tv'] }),
    tmdbId: integer('tmdb_id'),
    imdbId: text('imdb_id').unique(),
    title: text('title').notNull(),
    originalTitle: text('original_title'),
    year: integer('year'),
    /** TMDB's directors, joined with ", ". */
    directors: text('directors'),
    /** In minutes. */
    runtime: integer('runtime'),
    /** TMDB image paths, such as `/aVP45oS2cBL4WtZ1kB7r8uarruB.jpg`. */
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    /** When the TMDB data was last read; null for a film known only by its IMDb id. */
    refreshedAt: text('refreshed_at'),
  },
  (table) => [
    uniqueIndex('films_tmdb').on(table.tmdbKind, table.tmdbId),
    check('films_tmdb_pair', sql`(${table.tmdbKind} is null) = (${table.tmdbId} is null)`),
    check('films_identity', sql`${table.tmdbId} is not null or ${table.imdbId} is not null`),
  ],
);

/** One row per real venue. Meetup has the same cinema under several ids, so events reach it through `venue_aliases`. */
export const venues = sqliteTable('venues', {
  /** A readable slug, e.g. `lab111`. */
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  address: text('address'),
  city: text('city').notNull(),
});

/** Every Meetup venue id that points to a venue. A Meetup id missing here is flagged, never guessed. */
export const venueAliases = sqliteTable('venue_aliases', {
  meetupVenueId: text('meetup_venue_id').primaryKey(),
  venueId: text('venue_id')
    .notNull()
    .references(() => venues.id),
});

/** Every event the site has seen. Past events stay: they become the archive (plan §5.2). */
export const events = sqliteTable(
  'events',
  {
    /** Meetup's event id. */
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    url: text('url').notNull(),
    /** The meetup time, as a UTC ISO string. Never the film start. */
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at'),
    /** The host's description as Meetup has it: the fallback for any field that can't be read. */
    description: text('description').notNull(),
    cancelled: integer('cancelled', { mode: 'boolean' }).notNull(),
    /** Meetup's venue, kept as given; `venue_aliases` maps it to a venue. */
    meetupVenueId: text('meetup_venue_id'),
    meetupVenueName: text('meetup_venue_name'),
    /** Null until the events page has been read: the iCal feed carries no counts. */
    going: integer('going'),
    /** Null when there is no RSVP limit, or before the events page has been read. */
    rsvpLimit: integer('rsvp_limit'),
    coverImageUrl: text('cover_image_url'),
    /** A hash of the fields that parsing and film matching read, to skip unchanged events (plan §9, ingest step 2). */
    contentHash: text('content_hash').notNull(),
    firstSeenAt: text('first_seen_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
    /** When the hashed content last changed. */
    changedAt: text('changed_at').notNull(),
    /** Set when a future event disappears from Meetup; cleared if it comes back. Never deleted. */
    unlistedAt: text('unlisted_at'),
    /** The film, once matched with confidence (src/lib/films/match.ts). */
    filmId: integer('film_id').references(() => films.id),
    /** The `contentHash` the last finished match ran on: a new hash means matching again. */
    filmCheckedHash: text('film_checked_hash'),
    /** Why the last match found no film, for admin: `no-director`, `no-match`, `ambiguous`… */
    filmMatchProblem: text('film_match_problem'),
  },
  (table) => [index('events_starts_at').on(table.startsAt)],
);

/**
 * A film page at a cinema, as the daily cinema read last found it (plan §5.7). Rows stay when the page
 * goes; their screenings don't. The version is as the cinema states it, never guessed.
 */
export const billedFilms = sqliteTable(
  'billed_films',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    venueId: text('venue_id')
      .notNull()
      .references(() => venues.id),
    sourceUrl: text('source_url').notNull(),
    /** As billed, such as "Akira (4K Restoration) (ENG SUBS)". */
    title: text('title').notNull(),
    /** The title the reader cleaned for matching, such as "Akira"; null when nothing was left. */
    searchTitle: text('search_title'),
    year: integer('year'),
    directors: text('directors'),
    /** In minutes. */
    runtime: integer('runtime'),
    language: text('language'),
    subtitles: text('subtitles'),
    /** The film, once matched with confidence (src/lib/films/match.ts). */
    filmId: integer('film_id').references(() => films.id),
    /** A hash of what matching reads (the title, year and director): a new one means matching again. */
    cluesHash: text('clues_hash').notNull(),
    /** The `cluesHash` the last finished match ran on. */
    filmCheckedHash: text('film_checked_hash'),
    filmMatchProblem: text('film_match_problem'),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => [uniqueIndex('billed_films_source').on(table.venueId, table.sourceUrl)],
);

/** Every screening still to come at the cinemas the site reads, replaced cinema by cinema after each complete read. */
export const screenings = sqliteTable(
  'screenings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    billedFilmId: integer('billed_film_id')
      .notNull()
      .references(() => billedFilms.id),
    /** UTC ISO. */
    startsAt: text('starts_at').notNull(),
    /** The subtitles this screening states, when it states its own. */
    subtitles: text('subtitles'),
    ticketUrl: text('ticket_url'),
  },
  (table) => [index('screenings_billed_film').on(table.billedFilmId, table.startsAt), index('screenings_starts_at').on(table.startsAt)],
);

/** Each cinema's last read: the counts are the health check (the cinema run's §2), and a failed read keeps the screenings before it. */
export const cinemaReads = sqliteTable('cinema_reads', {
  venueId: text('venue_id')
    .primaryKey()
    .references(() => venues.id),
  readAt: text('read_at').notNull(),
  complete: integer('complete', { mode: 'boolean' }).notNull(),
  films: integer('films').notNull(),
  screenings: integer('screenings').notNull(),
  /** The failed pages, one per line. */
  problems: text('problems'),
  /** When the screenings in the index were last replaced. */
  storedAt: text('stored_at'),
});

/** The group's own figures from Meetup, one row per group; the ingest refreshes it on every read of the events page. */
export const groupStats = sqliteTable('group_stats', {
  /** Meetup's urlname, `amsterdam-film-group`. */
  id: text('id').primaryKey(),
  /** The average of the ratings members give events afterwards, out of 5. */
  ratingAverage: real('rating_average').notNull(),
  ratingCount: integer('rating_count').notNull(),
  readAt: text('read_at').notNull(),
});

// Member sign-in (plan §6, §9): Better Auth's four tables, under the names its Drizzle adapter expects with
// `usePlural` (src/lib/auth.ts). Times are milliseconds since 1970, as Better Auth writes them.

/** A member who has signed in. Name, email and picture come from their Google account. */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

/** A signed-in browser. Its token is in the session cookie. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    /** Not recorded: IP tracking is off (src/lib/auth.ts). */
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('sessions_user').on(table.userId)],
);

/** How a member signs in: one row per provider (Google; later the email link). */
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    /** The member's id at the provider. */
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    /** Unused: the site has no passwords. */
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('accounts_user').on(table.userId)],
);

/** Short-lived values during a sign-in, such as the OAuth state; later the email links' tokens. */
export const verifications = sqliteTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('verifications_identifier').on(table.identifier)],
);

// Recommendations (plan §5.3): members who sign in recommend films for the group and send screenings they
// spotted. Only the hosts see them; a member sees only their own.

/** One row per film a member recommended. A host can set one aside. */
export const recommendedFilms = sqliteTable('recommended_films', {
  filmId: integer('film_id')
    .primaryKey()
    .references(() => films.id),
  /** When the first member recommended it. */
  createdAt: text('created_at').notNull(),
  /** Set when a host set the film aside (done, or not for the group); its recommendations stay. */
  hiddenAt: text('hidden_at'),
});

/** One member's recommendation of a film, with their line on why. Deleted with the member's account. */
export const recommendations = sqliteTable(
  'recommendations',
  {
    filmId: integer('film_id')
      .notNull()
      .references(() => recommendedFilms.filmId),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.filmId, table.userId] }), index('recommendations_user').on(table.userId, table.createdAt)],
);

/** A screening or a venue a member spotted, as a link. It goes to the hosts, never to a public list. */
export const screeningTips = sqliteTable(
  'screening_tips',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    /** Set when a host has dealt with it. */
    doneAt: text('done_at'),
  },
  (table) => [index('screening_tips_user').on(table.userId, table.createdAt), index('screening_tips_created').on(table.createdAt)],
);
