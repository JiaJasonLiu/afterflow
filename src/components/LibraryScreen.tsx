import { useMemo, useState } from 'react';
import { Clapperboard, Plus } from 'lucide-react';
import { useStore } from '../hooks/useStore.ts';
import {
  emotionById,
  nextEpisode,
  progressOf,
  totalCount,
  watchedCount,
  type MediaItem,
  type WatchStatus,
} from '../engine/types.ts';
import { Poster, ProgressBar } from './ui.tsx';

type KindFilter = 'all' | 'tv' | 'anime' | 'movie';
type StatusFilter = 'all' | WatchStatus;

const KINDS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tv', label: 'TV' },
  { id: 'anime', label: 'Anime' },
  { id: 'movie', label: 'Movies' },
];

const STATUSES: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'watching', label: 'Watching' },
  { id: 'plan', label: 'Watchlist' },
  { id: 'completed', label: 'Completed' },
  { id: 'dropped', label: 'Dropped' },
];

function matchesKind(item: MediaItem, kind: KindFilter): boolean {
  if (kind === 'all') return true;
  if (kind === 'anime') return item.isAnime;
  if (kind === 'tv') return item.type === 'tv' && !item.isAnime;
  return item.type === 'movie';
}

function LibraryCard({
  item, posterUrl, onOpen,
}: { item: MediaItem; posterUrl?: string; onOpen: () => void }) {
  const progress = progressOf(item);
  const next = item.type === 'tv' ? nextEpisode(item) : null;
  const glow = item.emotion ? emotionById(item.emotion).color : undefined;

  return (
    <button onClick={onOpen} className="group text-left transition-transform active:scale-[0.97]">
      <div
        className="relative aspect-2/3 overflow-hidden rounded-2xl border border-line bg-panel"
        style={glow ? { boxShadow: `0 6px 24px -8px ${glow}66` } : undefined}
      >
        <Poster item={item} posterUrl={posterUrl} className="h-full w-full" />
        {item.emotion && (
          <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-sm backdrop-blur-sm">
            {emotionById(item.emotion).emoji}
          </span>
        )}
        {item.rating > 0 && (
          <span className="absolute top-2 left-2 rounded-full bg-ink/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-ember backdrop-blur-sm">
            ★ {item.rating}
          </span>
        )}
        {progress > 0 && progress < 1 && (
          <ProgressBar value={progress} className="absolute right-2 bottom-2 left-2 h-1.5 bg-ink/60" />
        )}
      </div>
      <p className="mt-2 truncate text-sm font-semibold">{item.title}</p>
      <p className="truncate font-mono text-[11px] text-dim">
        {item.type === 'movie'
          ? item.watchedAt ? 'Watched' : (item.year ?? 'Movie')
          : next
            ? `Next · S${next.season}E${next.ep.n}`
            : totalCount(item) > 0
              ? 'Caught up'
              : (item.year ?? '')}
        {item.type === 'tv' && ` · ${watchedCount(item)}/${totalCount(item)}`}
      </p>
    </button>
  );
}

export function LibraryScreen({
  onOpenItem, onGoSearch,
}: { onOpenItem: (id: string) => void; onGoSearch: () => void }) {
  const { items, posterUrls } = useStore();
  const [kind, setKind] = useState<KindFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');

  const list = useMemo(() => {
    return Object.values(items)
      .filter((it) => matchesKind(it, kind))
      .filter((it) => status === 'all' || it.status === status)
      .sort((a, b) => b.addedAt - a.addedAt);
  }, [items, kind, status]);

  const empty = Object.keys(items).length === 0;

  return (
    <div className="px-4 pt-safe">
      <header className="flex items-end justify-between pt-6 pb-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.25em] text-dim uppercase">Your library</p>
          <h1 className="glow-text text-3xl font-bold tracking-tight">Afterglow</h1>
        </div>
        <button
          onClick={onGoSearch}
          className="glow-gradient flex h-10 w-10 items-center justify-center rounded-full text-ink transition-transform active:scale-90"
          aria-label="Add a title"
        >
          <Plus size={22} strokeWidth={2.5} />
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              kind === k.id ? 'glow-gradient text-ink' : 'bg-panel text-dim'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            onClick={() => setStatus(s.id)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              status === s.id ? 'border-ember text-ember' : 'border-line text-dim'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="mt-20 flex flex-col items-center text-center">
          <Clapperboard size={40} className="text-dim" />
          <p className="mt-4 text-lg font-semibold">Nothing here yet</p>
          <p className="mt-1 max-w-60 text-sm text-dim">
            Add your first show or movie and start checking in.
          </p>
          <button
            onClick={onGoSearch}
            className="glow-gradient mt-5 rounded-full px-5 py-2.5 font-semibold text-ink"
          >
            Find something to watch
          </button>
        </div>
      ) : list.length === 0 ? (
        <p className="mt-16 text-center text-sm text-dim">No titles match these filters.</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-x-3 gap-y-5 pb-28">
          {list.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              posterUrl={posterUrls[item.id]}
              onOpen={() => onOpenItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
