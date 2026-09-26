// ─── TMDB client (pure TS) ───────────────────────────────────────────────────
// Supports both auth styles: a v3 api_key (32-char hex) or a v4 read token
// (long JWT starting with "ey", sent as a Bearer header).

import type { MediaItem, MediaType, SeasonInfo } from './types.ts';

const BASE = 'https://api.themoviedb.org/3';
export const IMG = (path: string, size = 'w342') => `https://image.tmdb.org/t/p/${size}${path}`;

function authFetch(apiKey: string, path: string, params: Record<string, string> = {}): Promise<Response> {
  const url = new URL(BASE + path);
  const isV4 = apiKey.startsWith('ey');
  if (!isV4) url.searchParams.set('api_key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), {
    headers: isV4 ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });
}

async function getJson<T>(apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const res = await authFetch(apiKey, path, params);
  if (res.status === 401) throw new Error('TMDB rejected the API key. Check it in Settings.');
  if (!res.ok) throw new Error(`TMDB error ${res.status}`);
  return res.json() as Promise<T>;
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResult {
  tmdbId: number;
  type: MediaType;
  title: string;
  year?: string;
  posterPath?: string;
  overview: string;
  isAnime: boolean;
}

interface TmdbMultiResult {
  id: number;
  media_type: string;
  name?: string;
  title?: string;
  first_air_date?: string;
  release_date?: string;
  poster_path?: string | null;
  overview?: string;
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
}

const looksAnime = (r: { genre_ids?: number[]; genres?: { id: number }[]; original_language?: string; origin_country?: string[] }) => {
  const genreIds = r.genre_ids ?? r.genres?.map((g) => g.id) ?? [];
  const animation = genreIds.includes(16);
  const jp = r.original_language === 'ja' || (r.origin_country ?? []).includes('JP');
  return animation && jp;
};

export async function searchMulti(apiKey: string, query: string): Promise<SearchResult[]> {
  const data = await getJson<{ results: TmdbMultiResult[] }>(apiKey, '/search/multi', {
    query,
    include_adult: 'false',
  });
  return data.results
    .filter((r) => r.media_type === 'tv' || r.media_type === 'movie')
    .map((r) => ({
      tmdbId: r.id,
      type: r.media_type as MediaType,
      title: r.name ?? r.title ?? 'Untitled',
      year: (r.first_air_date ?? r.release_date ?? '').slice(0, 4) || undefined,
      posterPath: r.poster_path ?? undefined,
      overview: r.overview ?? '',
      isAnime: looksAnime(r),
    }));
}

// ─── Full item fetch ─────────────────────────────────────────────────────────

interface TmdbShow {
  id: number;
  name: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { id: number; name: string }[];
  original_language?: string;
  origin_country?: string[];
  seasons?: { season_number: number; name: string; episode_count: number }[];
}

interface TmdbSeason {
  season_number: number;
  name: string;
  episodes?: { episode_number: number; name: string; air_date?: string; runtime?: number | null }[];
}

interface TmdbMovie {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { id: number; name: string }[];
  original_language?: string;
  runtime?: number | null;
}

async function fetchSeasons(apiKey: string, tvId: number, seasonNumbers: number[]): Promise<SeasonInfo[]> {
  // fetch in small parallel batches to be polite to the API
  const out: SeasonInfo[] = [];
  const batchSize = 5;
  for (let i = 0; i < seasonNumbers.length; i += batchSize) {
    const batch = seasonNumbers.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((n) => getJson<TmdbSeason>(apiKey, `/tv/${tvId}/season/${n}`)),
    );
    for (const s of results) {
      out.push({
        n: s.season_number,
        name: s.name || `Season ${s.season_number}`,
        episodes: (s.episodes ?? []).map((e) => ({
          n: e.episode_number,
          name: e.name || `Episode ${e.episode_number}`,
          airDate: e.air_date || undefined,
          runtime: e.runtime ?? undefined,
        })),
      });
    }
  }
  return out.sort((a, b) => a.n - b.n);
}

/** Build a full MediaItem (without status/rating — the store sets those) */
export async function fetchFullItem(apiKey: string, type: MediaType, tmdbId: number): Promise<Omit<MediaItem, 'status' | 'rating' | 'note' | 'addedAt'>> {
  if (type === 'movie') {
    const m = await getJson<TmdbMovie>(apiKey, `/movie/${tmdbId}`);
    return {
      id: `movie-${m.id}`,
      tmdbId: m.id,
      type: 'movie',
      isAnime: looksAnime(m) || (m.original_language === 'ja' && (m.genres ?? []).some((g) => g.id === 16)),
      title: m.title,
      year: (m.release_date ?? '').slice(0, 4) || undefined,
      overview: m.overview ?? '',
      genres: (m.genres ?? []).map((g) => g.name),
      posterPath: m.poster_path ?? undefined,
      backdropPath: m.backdrop_path ?? undefined,
      runtime: m.runtime ?? undefined,
    };
  }
  const s = await getJson<TmdbShow>(apiKey, `/tv/${tmdbId}`);
  const seasonNumbers = (s.seasons ?? []).map((x) => x.season_number);
  const seasons = await fetchSeasons(apiKey, s.id, seasonNumbers);
  return {
    id: `tv-${s.id}`,
    tmdbId: s.id,
    type: 'tv',
    isAnime: looksAnime(s),
    title: s.name,
    year: (s.first_air_date ?? '').slice(0, 4) || undefined,
    overview: s.overview ?? '',
    genres: (s.genres ?? []).map((g) => g.name),
    posterPath: s.poster_path ?? undefined,
    backdropPath: s.backdrop_path ?? undefined,
    seasons,
    watched: {},
  };
}

/** Download a poster as a Blob for offline caching. Returns null on failure. */
export async function fetchPosterBlob(posterPath: string): Promise<Blob | null> {
  try {
    const res = await fetch(IMG(posterPath, 'w342'));
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}
