# Afterglow

A local-first tracker for TV shows, anime, and movies. TV Time energy, none of the lag: every interaction after adding a title is a pure local state change — no spinners in the check-in loop.

**watch. feel. remember.**

## Quick start

```bash
npm install
npm run dev
```

Open it on your phone via the dev server's network URL (or `vite --host`), add it to your home screen, and it behaves like an app.

First run: grab a free TMDB API key at https://www.themoviedb.org/settings/api and paste it into **Settings**. Both the v3 key and the v4 read token work — the client detects which one you pasted.

## What it does

- **TMDB search** for shows, anime, and movies. Adding a title downloads its full season/episode list into IndexedDB, so tracking works fully offline afterwards. Posters are cached as blobs too.
- **Episode-level check-ins** — the detail screen always surfaces your next unwatched episode with a one-tap check-in button. Season-level bulk marking and per-episode toggles included. Statuses auto-advance (first check-in → Watching, last episode → Completed).
- **Stars + emotions** — half-step 5-star ratings, plus an emotion reaction (😍😂😢🤯😐😤) per episode check-in and per title, with a free-form "how I feel about it" note. Emotion tints glow under library cards.
- **Anime awareness** — titles tagged anime when TMDB marks them Animation + Japanese origin; runtime fallbacks assume 24-min episodes for anime, 40 for live action.
- **Stats** — episodes/movies/time watched, 14-day activity, emotion distribution, most-binged show.
- **Your data stays yours** — everything lives in IndexedDB. JSON export/import for backup and device moves. The only network calls are to TMDB.

## Architecture

Engine-before-UI, single bridge:

```
src/engine/     pure TS, zero React imports
  types.ts      data model + derived helpers (progress, next episode, minutes)
  store.ts      state + actions + IndexedDB persistence — the ONLY mutation surface
  tmdb.ts       API client + poster blob caching
  stats.ts      pure stats derivation
  db.ts         ~50-line IndexedDB wrapper, no deps
src/hooks/
  useStore.ts   useSyncExternalStore — the single React↔engine bridge
src/components/ screens + shared atoms; UI never mutates engine state directly
```

## Tests

```bash
npm test
```

Headless engine tests (progress math, next-episode ordering, specials exclusion, runtime fallbacks, stats aggregation) plus a jsdom smoke render with a fake IndexedDB.

## Builds

- `npm run build` — installable **PWA**: manifest + icons + workbox service worker. App shell and fonts precached, TMDB posters runtime-cached (cache-first, 90 days). Host `dist/` anywhere (even a LAN static server), open on your phone, Add to Home Screen — it launches and works fully offline afterwards.
- `npm run build:preview` — one **self-contained HTML file** (`dist-preview/index.html`). Everything inlined: JS, CSS, fonts. Open it from anywhere. If storage is blocked in the hosting context it silently falls back to in-memory mode (fully functional, just not persistent).

## Refreshing shows

The ↻ button on a show's detail screen refetches from TMDB and merges: new seasons/episodes and updated artwork come in, your check-ins/rating/emotions/notes are preserved, and a Completed show with fresh episodes flips back to Watching (with a `+N new episodes` badge).

## Known limitations

- Long-running shows (e.g. One Piece) fetch every season on add — a few seconds, batched 5 at a time. One-time cost; use ↻ to pull new episodes later.
- Poster blob caching relies on TMDB's image CDN allowing CORS (it does today); if a fetch fails it falls back to the hotlinked URL.
- Refresh is manual per-show. A library-wide "check all airing shows" sweep would be the next step if you want it.
# afterflow
