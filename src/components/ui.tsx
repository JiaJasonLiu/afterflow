import { useState } from 'react';
import { Star } from 'lucide-react';
import { EMOTIONS, emotionById, type EmotionId, type MediaItem } from '../engine/types.ts';
import { IMG } from '../engine/tmdb.ts';

// ─── Poster image with blob-cache fallback ──────────────────────────────────

export function Poster({
  item, posterUrl, className = '',
}: { item: { title: string; posterPath?: string }; posterUrl?: string; className?: string }) {
  const src = posterUrl ?? (item.posterPath ? IMG(item.posterPath) : undefined);
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-panel-2 text-dim ${className}`}>
        <span className="px-2 text-center text-xs leading-tight">{item.title}</span>
      </div>
    );
  }
  return <img src={src} alt={item.title} loading="lazy" className={`object-cover ${className}`} />;
}

// ─── Progress bar with afterglow fill ───────────────────────────────────────

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-line ${className}`}>
      <div
        className="glow-gradient h-full rounded-full transition-[width] duration-300"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  );
}

// ─── Half-step star rating ───────────────────────────────────────────────────

export function StarRating({
  value, onChange, size = 30,
}: { value: number; onChange: (v: number) => void; size?: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.min(Math.max(value - (star - 1), 0), 1); // 0 | .5 | 1
        return (
          <div key={star} className="relative" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-line" fill="currentColor" strokeWidth={0} />
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-ember" fill="currentColor" strokeWidth={0} />
            </div>
            {/* left half = X.5, right half = X.0; tapping current value clears */}
            <button
              aria-label={`Rate ${star - 0.5} stars`}
              className="absolute inset-y-0 left-0 w-1/2"
              onClick={() => onChange(value === star - 0.5 ? 0 : star - 0.5)}
            />
            <button
              aria-label={`Rate ${star} stars`}
              className="absolute inset-y-0 right-0 w-1/2"
              onClick={() => onChange(value === star ? 0 : star)}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Emotion picker row ──────────────────────────────────────────────────────

export function EmotionPicker({
  value, onPick, compact = false,
}: { value?: EmotionId; onPick: (e: EmotionId | undefined) => void; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {EMOTIONS.map((e) => {
        const active = value === e.id;
        return (
          <button
            key={e.id}
            onClick={() => onPick(active ? undefined : e.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-transform active:scale-90 ${
              active ? 'border-transparent text-ink' : 'border-line bg-panel text-dim'
            }`}
            style={active ? { background: e.color } : undefined}
          >
            <span className="text-base leading-none">{e.emoji}</span>
            {!compact && <span className="font-medium">{e.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── Emotion pop sheet: the afterglow moment after a check-in ───────────────

export function EmotionPopSheet({
  title, onPick, onSkip,
}: { title: string; onPick: (e: EmotionId) => void; onSkip: () => void }) {
  const [picked, setPicked] = useState<EmotionId | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 backdrop-blur-sm" onClick={onSkip}>
      <div
        className="animate-pop-in mx-3 mb-6 w-full max-w-md rounded-3xl border border-line bg-panel p-5 pb-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center text-xs font-semibold tracking-[0.2em] text-dim uppercase">Checked in</p>
        <p className="mt-1 text-center text-lg font-semibold">{title}</p>
        <p className="glow-text mt-4 text-center text-sm font-semibold">How did it feel?</p>
        <div className="mt-3 flex justify-center gap-2">
          {EMOTIONS.map((e) => (
            <button
              key={e.id}
              aria-label={e.label}
              onClick={() => {
                setPicked(e.id);
                setTimeout(() => onPick(e.id), 260);
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl transition-transform active:scale-90 ${
                picked === e.id ? 'animate-glow-pulse scale-110 border-transparent' : 'border-line bg-panel-2'
              }`}
              style={picked === e.id ? { background: e.color } : undefined}
            >
              {e.emoji}
            </button>
          ))}
        </div>
        {picked && (
          <p className="mt-3 text-center text-sm text-dim">{emotionById(picked).label}</p>
        )}
        {!picked && (
          <button onClick={onSkip} className="mt-4 w-full text-center text-sm text-dim">
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Status chip helpers ─────────────────────────────────────────────────────

export const STATUS_LABEL: Record<MediaItem['status'], string> = {
  watching: 'Watching',
  completed: 'Completed',
  plan: 'Watchlist',
  dropped: 'Dropped',
};
