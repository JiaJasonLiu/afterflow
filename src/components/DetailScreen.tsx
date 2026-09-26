import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useStore } from '../hooks/useStore.ts';
import {
  checkInNext,
  markSeason,
  refreshItem,
  removeItem,
  setEmotion,
  setEpisodeEmotion,
  setNote,
  setRating,
  setStatus,
  toggleEpisode,
  toggleMovieWatched,
} from '../engine/store.ts';
import {
  emotionById,
  epKey,
  nextEpisode,
  progressOf,
  totalCount,
  watchedCount,
  type EmotionId,
  type MediaItem,
  type WatchStatus,
} from '../engine/types.ts';
import { IMG } from '../engine/tmdb.ts';
import { EmotionPicker, EmotionPopSheet, Poster, ProgressBar, StarRating, STATUS_LABEL } from './ui.tsx';

const STATUS_ORDER: WatchStatus[] = ['watching', 'plan', 'completed', 'dropped'];

function SeasonBlock({ item, seasonN }: { item: MediaItem; seasonN: number }) {
  const season = item.seasons?.find((s) => s.n === seasonN);
  const [open, setOpen] = useState(false);
  const [pendingEmotion, setPendingEmotion] = useState<{ ep: number; name: string } | null>(null);
  if (!season) return null;

  const w = item.watched ?? {};
  const done = season.episodes.filter((ep) => w[epKey(season.n, ep.n)]).length;
  const allDone = done === season.episodes.length && season.episodes.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3.5">
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold">{season.name}</p>
          <p className="font-mono text-[11px] text-dim">
            {done}/{season.episodes.length} watched
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            markSeason(item.id, season.n, !allDone);
          }}
          aria-label={allDone ? 'Unmark season' : 'Mark season watched'}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
            allDone ? 'glow-gradient border-transparent text-ink' : 'border-line text-dim'
          }`}
        >
          <Check size={16} />
        </button>
        <ChevronDown size={18} className={`shrink-0 text-dim transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-line">
          {season.episodes.map((ep) => {
            const checkIn = w[epKey(season.n, ep.n)];
            return (
              <div key={ep.n} className="flex items-center gap-3 border-b border-line/50 px-3.5 py-2.5 last:border-b-0">
                <button
                  onClick={() => {
                    const nowWatched = toggleEpisode(item.id, season.n, ep.n);
                    if (nowWatched) setPendingEmotion({ ep: ep.n, name: `S${season.n}E${ep.n} · ${ep.name}` });
                  }}
                  aria-label={checkIn ? 'Unmark episode' : 'Mark episode watched'}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-transform active:scale-90 ${
                    checkIn ? 'glow-gradient border-transparent text-ink' : 'border-line text-dim'
                  }`}
                >
                  <Check size={14} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${checkIn ? 'text-dim' : ''}`}>
                    <span className="font-mono text-[11px] text-dim">E{ep.n}</span> {ep.name}
                  </p>
                </div>
                {checkIn?.emotion && <span className="text-base">{emotionById(checkIn.emotion).emoji}</span>}
              </div>
            );
          })}
        </div>
      )}

      {pendingEmotion && (
        <EmotionPopSheet
          title={pendingEmotion.name}
          onPick={(e: EmotionId) => {
            setEpisodeEmotion(item.id, season.n, pendingEmotion.ep, e);
            setPendingEmotion(null);
          }}
          onSkip={() => setPendingEmotion(null)}
        />
      )}
    </div>
  );
}

export function DetailScreen({ id, onBack }: { id: string; onBack: () => void }) {
  const { items, posterUrls } = useStore();
  const item = items[id];
  const [pending, setPending] = useState<{ season: number; episode: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMsg('');
    try {
      const added = await refreshItem(id);
      setRefreshMsg(added > 0 ? `+${added} new episode${added === 1 ? '' : 's'}` : 'Up to date');
    } catch (e) {
      setRefreshMsg(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
      setTimeout(() => setRefreshMsg(''), 2500);
    }
  };

  const next = useMemo(() => (item?.type === 'tv' ? nextEpisode(item) : null), [item]);
  if (!item) return null;

  const progress = progressOf(item);
  const glow = item.emotion ? emotionById(item.emotion).color : '#FFB454';

  const checkIn = () => {
    const result = checkInNext(id);
    if (result) setPending(result);
  };

  return (
    <div className="pb-28">
      {/* backdrop header */}
      <div className="relative h-52 w-full overflow-hidden">
        {item.backdropPath ? (
          <img src={IMG(item.backdropPath, 'w780')} alt="" className="h-full w-full object-cover opacity-60" />
        ) : (
          <div className="h-full w-full" style={{ background: `radial-gradient(circle at 30% 20%, ${glow}33, transparent 70%)` }} />
        )}
        <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/40 to-transparent" />
        <button
          onClick={onBack}
          aria-label="Back"
          className="absolute top-4 left-4 flex h-10 w-10 items-center justify-center rounded-full bg-ink/60 backdrop-blur-sm"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {refreshMsg && (
            <span className="animate-pop-in rounded-full bg-ink/70 px-3 py-1.5 text-xs font-semibold text-ember backdrop-blur-sm">
              {refreshMsg}
            </span>
          )}
          <button
            onClick={() => void refresh()}
            aria-label="Check for new episodes"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/60 text-dim backdrop-blur-sm"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin text-ember' : ''} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Remove from library"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/60 text-dim backdrop-blur-sm"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="-mt-16 flex items-end gap-4 px-4">
        <Poster item={item} posterUrl={posterUrls[item.id]} className="h-36 w-24 shrink-0 rounded-xl border border-line shadow-xl" />
        <div className="min-w-0 pb-1">
          <h1 className="text-xl leading-tight font-bold">{item.title}</h1>
          <p className="mt-1 font-mono text-[11px] text-dim">
            {[item.isAnime ? 'Anime' : item.type === 'tv' ? 'TV' : 'Movie', item.year, ...item.genres.slice(0, 2)]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5 px-4">
        {/* status row */}
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(id, s)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                item.status === s ? 'glow-gradient border-transparent text-ink' : 'border-line text-dim'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* the check-in loop */}
        {item.type === 'tv' ? (
          <div className="rounded-3xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Progress</p>
              <p className="font-mono text-[11px] text-dim">
                {watchedCount(item)}/{totalCount(item)} eps
              </p>
            </div>
            <ProgressBar value={progress} className="mt-2 h-1.5" />
            {next ? (
              <button
                onClick={checkIn}
                className="glow-gradient mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-ink transition-transform active:scale-[0.98]"
              >
                <Play size={18} fill="currentColor" />
                <span>
                  Check in S{next.season}E{next.ep.n}
                </span>
              </button>
            ) : totalCount(item) > 0 ? (
              <p className="glow-text mt-4 text-center font-semibold">You're all caught up ✦</p>
            ) : null}
            {next && <p className="mt-2 truncate text-center text-xs text-dim">{next.ep.name}</p>}
          </div>
        ) : (
          <button
            onClick={() => toggleMovieWatched(id)}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold transition-transform active:scale-[0.98] ${
              item.watchedAt ? 'border border-line bg-panel text-dim' : 'glow-gradient text-ink'
            }`}
          >
            <Check size={18} />
            {item.watchedAt ? `Watched ${new Date(item.watchedAt).toLocaleDateString()}` : 'Mark as watched'}
          </button>
        )}

        {/* rating + feeling */}
        <div className="rounded-3xl border border-line bg-panel p-4">
          <p className="font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Your verdict</p>
          <div className="mt-3 flex justify-center">
            <StarRating value={item.rating} onChange={(v) => setRating(id, v)} />
          </div>
          <p className="mt-4 mb-2 text-sm font-semibold text-dim">Overall feeling</p>
          <EmotionPicker value={item.emotion} onPick={(e) => setEmotion(id, e)} />
          <textarea
            defaultValue={item.note}
            onBlur={(e) => setNote(id, e.target.value)}
            placeholder="How do you feel about it? Notes, hot takes, favorite arcs…"
            rows={3}
            className="mt-4 w-full resize-none rounded-xl border border-line bg-panel-2 p-3 text-sm outline-none placeholder:text-dim focus:border-ember"
          />
        </div>

        {/* seasons */}
        {item.type === 'tv' && item.seasons && (
          <div className="flex flex-col gap-2.5">
            <p className="px-1 font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Episodes</p>
            {item.seasons
              .filter((s) => s.episodes.length > 0)
              .map((s) => (
                <SeasonBlock key={s.n} item={item} seasonN={s.n} />
              ))}
          </div>
        )}

        {item.overview && (
          <div className="px-1">
            <p className="font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Synopsis</p>
            <p className="mt-2 text-sm leading-relaxed text-dim">{item.overview}</p>
          </div>
        )}
      </div>

      {pending && (
        <EmotionPopSheet
          title={`S${pending.season}E${pending.episode} · ${pending.name}`}
          onPick={(e) => {
            setEpisodeEmotion(id, pending.season, pending.episode, e);
            setPending(null);
          }}
          onSkip={() => setPending(null)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-6 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
          <div className="animate-pop-in w-full max-w-sm rounded-3xl border border-line bg-panel p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold">Remove "{item.title}"?</p>
            <p className="mt-1 text-sm text-dim">Check-ins, rating, and notes for this title are deleted.</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-xl border border-line py-2.5 font-semibold text-dim">
                Keep it
              </button>
              <button
                onClick={() => {
                  removeItem(id);
                  onBack();
                }}
                className="flex-1 rounded-xl bg-rose py-2.5 font-semibold text-ink"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
