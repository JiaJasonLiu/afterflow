// Headless engine tests — pure logic, no DOM, no IndexedDB.
import assert from 'node:assert/strict';
import {
  epKey, nextEpisode, progressOf, totalCount, watchedCount, minutesWatched,
  type MediaItem,
} from '../src/engine/types.ts';
import { computeStats } from '../src/engine/stats.ts';

const show = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: 'tv-1', tmdbId: 1, type: 'tv', isAnime: true, title: 'Test Anime',
  overview: '', genres: [], status: 'watching', rating: 0, note: '', addedAt: Date.now(),
  seasons: [
    { n: 0, name: 'Specials', episodes: [{ n: 1, name: 'OVA' }] },
    { n: 1, name: 'Season 1', episodes: [
      { n: 1, name: 'Ep1', runtime: 24 }, { n: 2, name: 'Ep2', runtime: 24 }, { n: 3, name: 'Ep3' },
    ]},
    { n: 2, name: 'Season 2', episodes: [{ n: 1, name: 'S2E1', runtime: 25 }] },
  ],
  watched: {},
  ...over,
});

// specials excluded from progress
assert.equal(totalCount(show()), 4);

// next episode walks airing order and skips watched
const s1 = show({ watched: { [epKey(1, 1)]: { at: 1 } } });
assert.deepEqual(nextEpisode(s1)!.season, 1);
assert.equal(nextEpisode(s1)!.ep.n, 2);

const s2 = show({ watched: { [epKey(1, 1)]: { at: 1 }, [epKey(1, 2)]: { at: 2 }, [epKey(1, 3)]: { at: 3 } } });
assert.equal(nextEpisode(s2)!.season, 2);
assert.equal(nextEpisode(s2)!.ep.n, 1);

// caught up -> null
const done = show({ watched: {
  [epKey(1,1)]: {at:1}, [epKey(1,2)]: {at:2}, [epKey(1,3)]: {at:3}, [epKey(2,1)]: {at:4},
}});
assert.equal(nextEpisode(done), null);
assert.equal(progressOf(done), 1);
assert.equal(watchedCount(done), 4);

// runtime fallback: anime default 24min when episode runtime missing
assert.equal(minutesWatched(done), 24 + 24 + 24 + 25);

// movie counting
const movie: MediaItem = {
  id: 'movie-9', tmdbId: 9, type: 'movie', isAnime: false, title: 'Film',
  overview: '', genres: [], status: 'completed', rating: 4.5, note: '',
  addedAt: Date.now(), runtime: 120, watchedAt: Date.now(), emotion: 'loved',
};
assert.equal(totalCount(movie), 1);
assert.equal(watchedCount(movie), 1);
assert.equal(minutesWatched(movie), 120);

// stats aggregation
const withEmotion = show({ watched: {
  [epKey(1,1)]: { at: Date.now(), emotion: 'fun' },
  [epKey(1,2)]: { at: Date.now(), emotion: 'fun' },
}, emotion: 'mindblown' });
const stats = computeStats([withEmotion, movie]);
assert.equal(stats.episodesWatched, 2);
assert.equal(stats.moviesWatched, 1);
assert.equal(stats.minutes, 24 + 24 + 120);
assert.equal(stats.emotionCounts.fun, 2);
assert.equal(stats.emotionCounts.mindblown, 1);
assert.equal(stats.emotionCounts.loved, 1);
assert.equal(stats.mostBinged!.title, 'Test Anime');
assert.equal(stats.recentDays.length, 14);
assert.ok(stats.recentDays[13].count >= 2); // today has activity

// half-star validity range sanity
for (const v of [0, 0.5, 2.5, 5]) assert.ok(v >= 0 && v <= 5 && v * 2 === Math.round(v * 2));

console.log('✓ all engine tests passed');

// ─── mergeRefresh: preserves user state, detects new episodes ────────────────
import { mergeRefresh } from '../src/engine/store.ts';

const old = show({
  status: 'completed',
  rating: 4.5,
  note: 'peak fiction',
  emotion: 'mindblown',
  watched: { [epKey(1,1)]: {at:1,emotion:'fun'}, [epKey(1,2)]: {at:2}, [epKey(1,3)]: {at:3}, [epKey(2,1)]: {at:4} },
});
const fresh = {
  id: 'tv-1', tmdbId: 1, type: 'tv' as const, isAnime: true, title: 'Test Anime (Renamed)',
  overview: 'new synopsis', genres: ['Animation'], posterPath: '/new.jpg',
  seasons: [
    ...old.seasons!,
    { n: 3, name: 'Season 3', episodes: [{ n: 1, name: 'S3E1' }, { n: 2, name: 'S3E2' }] },
  ],
  watched: {},
};
const { item: merged, newEpisodes } = mergeRefresh(old, fresh);
assert.equal(newEpisodes, 2);
assert.equal(merged.status, 'watching');        // completed -> watching when new eps land
assert.equal(merged.rating, 4.5);               // user state preserved
assert.equal(merged.note, 'peak fiction');
assert.equal(merged.emotion, 'mindblown');
assert.equal(merged.watched![epKey(1,1)].emotion, 'fun');
assert.equal(merged.title, 'Test Anime (Renamed)');
assert.equal(watchedCount(merged), 4);
assert.equal(nextEpisode(merged)!.season, 3);

// no new episodes -> status untouched
const { item: same, newEpisodes: zero } = mergeRefresh(old, { ...fresh, seasons: old.seasons });
assert.equal(zero, 0);
assert.equal(same.status, 'completed');

console.log('✓ mergeRefresh tests passed');
