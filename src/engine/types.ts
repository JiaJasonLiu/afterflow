// ─── Afterglow engine types (pure TS, no React) ─────────────────────────────

export type MediaType = 'tv' | 'movie';

export type WatchStatus = 'watching' | 'completed' | 'plan' | 'dropped';

export type EmotionId = 'loved' | 'fun' | 'moved' | 'mindblown' | 'meh' | 'angry';

export interface EmotionDef {
  id: EmotionId;
  emoji: string;
  label: string;
  /** hex used for glow tints + stat bars */
  color: string;
}

export const EMOTIONS: EmotionDef[] = [
  { id: 'loved', emoji: '😍', label: 'Loved it', color: '#FF6B7A' },
  { id: 'fun', emoji: '😂', label: 'So fun', color: '#FFB454' },
  { id: 'moved', emoji: '😢', label: 'Hit me', color: '#7AA5FF' },
  { id: 'mindblown', emoji: '🤯', label: 'Mind-blown', color: '#C77AFF' },
  { id: 'meh', emoji: '😐', label: 'Meh', color: '#9C93A8' },
  { id: 'angry', emoji: '😤', label: 'Frustrating', color: '#FF8A5C' },
];

export const emotionById = (id: EmotionId): EmotionDef =>
  EMOTIONS.find((e) => e.id === id) ?? EMOTIONS[4];

export interface EpisodeInfo {
  /** episode number within its season */
  n: number;
  name: string;
  airDate?: string;
  runtime?: number; // minutes
}

export interface SeasonInfo {
  /** TMDB season number (0 = specials) */
  n: number;
  name: string;
  episodes: EpisodeInfo[];
}

export interface CheckIn {
  at: number; // epoch ms
  emotion?: EmotionId;
}

export interface MediaItem {
  /** internal id: `${type}-${tmdbId}` */
  id: string;
  tmdbId: number;
  type: MediaType;
  isAnime: boolean;
  title: string;
  year?: string;
  overview: string;
  genres: string[];
  posterPath?: string; // TMDB path, fallback if no cached blob
  backdropPath?: string;
  status: WatchStatus;
  rating: number; // 0–5 in 0.5 steps, 0 = unrated
  emotion?: EmotionId; // overall feeling
  note: string; // free-form "how I feel about it"
  addedAt: number;
  // tv only
  seasons?: SeasonInfo[];
  /** key `s{season}e{episode}` -> check-in */
  watched?: Record<string, CheckIn>;
  // movie only
  runtime?: number; // minutes
  watchedAt?: number; // epoch ms, undefined = not watched yet
}

export const epKey = (season: number, episode: number) => `s${season}e${episode}`;

export interface AppState {
  ready: boolean;
  apiKey: string;
  items: Record<string, MediaItem>;
  /** object URLs for cached poster blobs, keyed by item id */
  posterUrls: Record<string, string>;
}

// ─── Derived helpers ─────────────────────────────────────────────────────────

/** Episodes counted for progress: every non-specials episode */
export function countableEpisodes(item: MediaItem): { season: number; ep: EpisodeInfo }[] {
  if (!item.seasons) return [];
  return item.seasons
    .filter((s) => s.n > 0)
    .flatMap((s) => s.episodes.map((ep) => ({ season: s.n, ep })));
}

export function watchedCount(item: MediaItem): number {
  if (item.type === 'movie') return item.watchedAt ? 1 : 0;
  const w = item.watched ?? {};
  return countableEpisodes(item).filter(({ season, ep }) => w[epKey(season, ep.n)]).length;
}

export function totalCount(item: MediaItem): number {
  return item.type === 'movie' ? 1 : countableEpisodes(item).length;
}

export function progressOf(item: MediaItem): number {
  const total = totalCount(item);
  return total === 0 ? 0 : watchedCount(item) / total;
}

/** Next unwatched episode in airing order, or null when caught up */
export function nextEpisode(item: MediaItem): { season: number; ep: EpisodeInfo } | null {
  if (item.type !== 'tv') return null;
  const w = item.watched ?? {};
  for (const entry of countableEpisodes(item)) {
    if (!w[epKey(entry.season, entry.ep.n)]) return entry;
  }
  return null;
}

/** Best-guess minutes watched for an item */
export function minutesWatched(item: MediaItem): number {
  if (item.type === 'movie') return item.watchedAt ? (item.runtime ?? 110) : 0;
  const w = item.watched ?? {};
  let mins = 0;
  for (const { season, ep } of countableEpisodes(item)) {
    if (w[epKey(season, ep.n)]) mins += ep.runtime ?? (item.isAnime ? 24 : 40);
  }
  return mins;
}
