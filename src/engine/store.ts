// ─── Afterglow store (pure TS, framework-free) ───────────────────────────────
// Single source of truth. React talks to this exclusively through useStore.

import { idb, STORE_LIBRARY, STORE_META, STORE_POSTERS } from './db.ts';
import { fetchFullItem, fetchPosterBlob, type SearchResult } from './tmdb.ts';
import {
  epKey,
  nextEpisode,
  totalCount,
  watchedCount,
  type AppState,
  type EmotionId,
  type MediaItem,
  type WatchStatus,
} from './types.ts';

type Listener = () => void;

let state: AppState = { ready: false, apiKey: '', items: {}, posterUrls: {} };
const listeners = new Set<Listener>();

export function getState(): AppState {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

function putItem(item: MediaItem) {
  setState({ items: { ...state.items, [item.id]: item } });
  void idb.set(STORE_LIBRARY, item.id, item);
}

// ─── Boot ────────────────────────────────────────────────────────────────────

export async function init(): Promise<void> {
  const [apiKey, items] = await Promise.all([
    idb.get<string>(STORE_META, 'tmdbApiKey'),
    idb.getAll<MediaItem>(STORE_LIBRARY),
  ]);
  const map: Record<string, MediaItem> = {};
  for (const it of items) map[it.id] = it;

  // hydrate cached poster blobs into object URLs
  const posterUrls: Record<string, string> = {};
  await Promise.all(
    items.map(async (it) => {
      const blob = await idb.get<Blob>(STORE_POSTERS, it.id);
      if (blob) posterUrls[it.id] = URL.createObjectURL(blob);
    }),
  );

  setState({ ready: true, apiKey: apiKey ?? '', items: map, posterUrls });
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function setApiKey(key: string) {
  setState({ apiKey: key.trim() });
  void idb.set(STORE_META, 'tmdbApiKey', key.trim());
}

// ─── Library actions ─────────────────────────────────────────────────────────

export function hasItem(type: string, tmdbId: number): boolean {
  return Boolean(state.items[`${type}-${tmdbId}`]);
}

/** Add from a search result: fetch full details + cache poster. */
export async function addFromSearch(result: SearchResult): Promise<MediaItem> {
  const full = await fetchFullItem(state.apiKey, result.type, result.tmdbId);
  const item: MediaItem = {
    ...full,
    status: 'plan',
    rating: 0,
    note: '',
    addedAt: Date.now(),
  };
  putItem(item);

  if (item.posterPath) {
    void fetchPosterBlob(item.posterPath).then((blob) => {
      if (!blob) return;
      void idb.set(STORE_POSTERS, item.id, blob);
      setState({ posterUrls: { ...state.posterUrls, [item.id]: URL.createObjectURL(blob) } });
    });
  }
  return item;
}

export function removeItem(id: string) {
  const items = { ...state.items };
  delete items[id];
  const posterUrls = { ...state.posterUrls };
  if (posterUrls[id]) {
    URL.revokeObjectURL(posterUrls[id]);
    delete posterUrls[id];
  }
  setState({ items, posterUrls });
  void idb.del(STORE_LIBRARY, id);
  void idb.del(STORE_POSTERS, id);
}

export function setStatus(id: string, status: WatchStatus) {
  const item = state.items[id];
  if (!item) return;
  putItem({ ...item, status });
}

export function setRating(id: string, rating: number) {
  const item = state.items[id];
  if (!item) return;
  putItem({ ...item, rating });
}

export function setEmotion(id: string, emotion: EmotionId | undefined) {
  const item = state.items[id];
  if (!item) return;
  putItem({ ...item, emotion });
}

export function setNote(id: string, note: string) {
  const item = state.items[id];
  if (!item) return;
  putItem({ ...item, note });
}

// ─── Episode check-ins ───────────────────────────────────────────────────────

function withAutoStatus(item: MediaItem): MediaItem {
  const done = watchedCount(item);
  const total = totalCount(item);
  if (total > 0 && done >= total) return { ...item, status: 'completed' };
  if (done > 0 && item.status === 'plan') return { ...item, status: 'watching' };
  return item;
}

export function toggleEpisode(id: string, season: number, episode: number): boolean {
  const item = state.items[id];
  if (!item || item.type !== 'tv') return false;
  const key = epKey(season, episode);
  const watched = { ...(item.watched ?? {}) };
  const nowWatched = !watched[key];
  if (nowWatched) watched[key] = { at: Date.now() };
  else delete watched[key];
  putItem(withAutoStatus({ ...item, watched }));
  return nowWatched;
}

/** Check in the next unwatched episode. Returns what was checked in, or null. */
export function checkInNext(id: string): { season: number; episode: number; name: string } | null {
  const item = state.items[id];
  if (!item || item.type !== 'tv') return null;
  const next = nextEpisode(item);
  if (!next) return null;
  const watched = { ...(item.watched ?? {}), [epKey(next.season, next.ep.n)]: { at: Date.now() } };
  putItem(withAutoStatus({ ...item, watched }));
  return { season: next.season, episode: next.ep.n, name: next.ep.name };
}

export function setEpisodeEmotion(id: string, season: number, episode: number, emotion: EmotionId) {
  const item = state.items[id];
  if (!item || item.type !== 'tv') return;
  const key = epKey(season, episode);
  const existing = item.watched?.[key];
  if (!existing) return;
  putItem({ ...item, watched: { ...item.watched, [key]: { ...existing, emotion } } });
}

export function markSeason(id: string, season: number, asWatched: boolean) {
  const item = state.items[id];
  if (!item || item.type !== 'tv' || !item.seasons) return;
  const s = item.seasons.find((x) => x.n === season);
  if (!s) return;
  const watched = { ...(item.watched ?? {}) };
  for (const ep of s.episodes) {
    const key = epKey(season, ep.n);
    if (asWatched && !watched[key]) watched[key] = { at: Date.now() };
    if (!asWatched) delete watched[key];
  }
  putItem(withAutoStatus({ ...item, watched }));
}

// ─── Movies ──────────────────────────────────────────────────────────────────

export function toggleMovieWatched(id: string): boolean {
  const item = state.items[id];
  if (!item || item.type !== 'movie') return false;
  const nowWatched = !item.watchedAt;
  putItem({
    ...item,
    watchedAt: nowWatched ? Date.now() : undefined,
    status: nowWatched ? 'completed' : 'plan',
  });
  return nowWatched;
}

// ─── Refresh: pull new episodes/metadata without losing your history ────────

/** Pure merge: fresh TMDB data over an existing item, preserving user state. */
export function mergeRefresh(
  existing: MediaItem,
  fresh: Omit<MediaItem, 'status' | 'rating' | 'note' | 'addedAt'>,
): { item: MediaItem; newEpisodes: number } {
  const before = totalCount(existing);
  let item: MediaItem = {
    ...existing,
    title: fresh.title,
    year: fresh.year ?? existing.year,
    overview: fresh.overview || existing.overview,
    genres: fresh.genres.length ? fresh.genres : existing.genres,
    posterPath: fresh.posterPath ?? existing.posterPath,
    backdropPath: fresh.backdropPath ?? existing.backdropPath,
    isAnime: fresh.isAnime,
    seasons: fresh.seasons ?? existing.seasons,
    runtime: fresh.runtime ?? existing.runtime,
  };
  const newEpisodes = Math.max(0, totalCount(item) - before);
  // a completed show with fresh unwatched episodes goes back to Watching
  if (newEpisodes > 0 && item.status === 'completed') item = { ...item, status: 'watching' };
  return { item, newEpisodes };
}

/** Refetch a title from TMDB and merge. Returns the number of new episodes. */
export async function refreshItem(id: string): Promise<number> {
  const existing = state.items[id];
  if (!existing) return 0;
  const fresh = await fetchFullItem(state.apiKey, existing.type, existing.tmdbId);
  const { item, newEpisodes } = mergeRefresh(existing, fresh);
  putItem(item);

  // re-cache poster if the artwork changed or we never got the blob
  if (item.posterPath && (item.posterPath !== existing.posterPath || !state.posterUrls[id])) {
    void fetchPosterBlob(item.posterPath).then((blob) => {
      if (!blob) return;
      void idb.set(STORE_POSTERS, id, blob);
      setState({ posterUrls: { ...state.posterUrls, [id]: URL.createObjectURL(blob) } });
    });
  }
  return newEpisodes;
}

// ─── Export / import ─────────────────────────────────────────────────────────

export function exportJson(): string {
  return JSON.stringify(
    { app: 'afterglow', version: 1, exportedAt: new Date().toISOString(), items: Object.values(state.items) },
    null,
    2,
  );
}

export async function importJson(json: string): Promise<number> {
  const data = JSON.parse(json) as { app?: string; items?: MediaItem[] };
  if (data.app !== 'afterglow' || !Array.isArray(data.items)) {
    throw new Error('Not an Afterglow export file.');
  }
  for (const item of data.items) {
    putItem(item);
    if (item.posterPath && !state.posterUrls[item.id]) {
      void fetchPosterBlob(item.posterPath).then((blob) => {
        if (!blob) return;
        void idb.set(STORE_POSTERS, item.id, blob);
        setState({ posterUrls: { ...state.posterUrls, [item.id]: URL.createObjectURL(blob) } });
      });
    }
  }
  return data.items.length;
}

export async function clearAll(): Promise<void> {
  for (const url of Object.values(state.posterUrls)) URL.revokeObjectURL(url);
  await Promise.all([idb.clear(STORE_LIBRARY), idb.clear(STORE_POSTERS)]);
  setState({ items: {}, posterUrls: {} });
}
