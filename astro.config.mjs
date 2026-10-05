// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://afig.nl',
  adapter: cloudflare({
    // TMDB serves images at the requested size, so no transformations are needed (plan §9).
    imageService: 'passthrough',
  }),
  // No sessions: they would need a KV store, and form results don't need to survive a redirect (plan §9).
  session: false,
  // Downloaded at build time and served from the site, so pages make no requests to Google (plan §9, Fonts).
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Fraunces',
      cssVariable: '--font-fraunces',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['Georgia', 'serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'Figtree',
      cssVariable: '--font-figtree',
      weights: [400, 500, 600],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
  ],
});
