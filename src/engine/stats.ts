// ─── Stats derivation (pure) ─────────────────────────────────────────────────

import {
  countableEpisodes,
  epKey,
  minutesWatched,
  watchedCount,
  type EmotionId,
  type MediaItem,
} from './types.ts';

export interface LibraryStats {
  episodesWatched: number;
  moviesWatched: number;
  showsCompleted: number;
  minutes: number;
  emotionCounts: Record<EmotionId, number>;
  /** last 14 days of check-in activity, oldest first */
  recentDays: { label: string; count: number }[];
  mostBinged?: { title: string; count: number };
}

export function computeStats(items: MediaItem[]): LibraryStats {
  let episodesWatched = 0;
  let moviesWatched = 0;
  let showsCompleted = 0;
  let minutes = 0;
  const emotionCounts: Record<EmotionId, number> = {
    loved: 0, fun: 0, moved: 0, mindblown: 0, meh: 0, angry: 0,
  };

  const dayCounts = new Map<string, number>();
  const bump = (at: number) => {
    const d = new Date(at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  };

  let mostBinged: { title: string; count: number } | undefined;

  for (const item of items) {
    minutes += minutesWatched(item);
    if (item.emotion) emotionCounts[item.emotion]++;

    if (item.type === 'movie') {
      if (item.watchedAt) {
        moviesWatched++;
        bump(item.watchedAt);
      }
      continue;
    }

    const count = watchedCount(item);
    episodesWatched += count;
    if (item.status === 'completed') showsCompleted++;
    if (count > 0 && (!mostBinged || count > mostBinged.count)) {
      mostBinged = { title: item.title, count };
    }
    const w = item.watched ?? {};
    for (const { season, ep } of countableEpisodes(item)) {
      const c = w[epKey(season, ep.n)];
      if (c) {
        bump(c.at);
        if (c.emotion) emotionCounts[c.emotion]++;
      }
    }
  }

  const recentDays: { label: string; count: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    recentDays.push({
      label: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      count: dayCounts.get(key) ?? 0,
    });
  }

  return { episodesWatched, moviesWatched, showsCompleted, minutes, emotionCounts, recentDays, mostBinged };
}
