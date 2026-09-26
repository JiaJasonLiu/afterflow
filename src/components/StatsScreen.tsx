import { useMemo } from 'react';
import { useStore } from '../hooks/useStore.ts';
import { computeStats } from '../engine/stats.ts';
import { EMOTIONS } from '../engine/types.ts';

function BigStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <p className="glow-text text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-dim">{label}</p>
    </div>
  );
}

export function StatsScreen() {
  const { items } = useStore();
  const stats = useMemo(() => computeStats(Object.values(items)), [items]);

  const hours = Math.round(stats.minutes / 60);
  const days = stats.minutes / 60 / 24;
  const maxDay = Math.max(1, ...stats.recentDays.map((d) => d.count));
  const totalEmotions = Object.values(stats.emotionCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="px-4 pb-28">
      <header className="pt-6 pb-4">
        <p className="font-mono text-[11px] tracking-[0.25em] text-dim uppercase">Your watch life</p>
        <h1 className="text-3xl font-bold tracking-tight">Stats</h1>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <BigStat value={String(stats.episodesWatched)} label="episodes checked in" />
        <BigStat value={String(stats.moviesWatched)} label="movies watched" />
        <BigStat value={hours >= 48 ? `${days.toFixed(1)}d` : `${hours}h`} label="time watched" />
        <BigStat value={String(stats.showsCompleted)} label="shows completed" />
      </div>

      {stats.mostBinged && (
        <div className="mt-2.5 rounded-2xl border border-line bg-panel p-4">
          <p className="font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Most binged</p>
          <p className="mt-1 font-semibold">{stats.mostBinged.title}</p>
          <p className="text-xs text-dim">{stats.mostBinged.count} episodes</p>
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-line bg-panel p-4">
        <p className="font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Last 14 days</p>
        <div className="mt-3 flex h-20 items-end gap-1">
          {stats.recentDays.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-sm ${d.count > 0 ? 'glow-gradient' : 'bg-line'}`}
                style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }}
              />
              <span className="text-[9px] text-dim">{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 rounded-2xl border border-line bg-panel p-4">
        <p className="font-mono text-[11px] tracking-[0.2em] text-dim uppercase">How it all felt</p>
        {totalEmotions === 0 ? (
          <p className="mt-2 text-sm text-dim">React to check-ins and your feelings show up here.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2.5">
            {EMOTIONS.filter((e) => stats.emotionCounts[e.id] > 0)
              .sort((a, b) => stats.emotionCounts[b.id] - stats.emotionCounts[a.id])
              .map((e) => {
                const count = stats.emotionCounts[e.id];
                return (
                  <div key={e.id} className="flex items-center gap-2.5">
                    <span className="w-6 text-center text-lg">{e.emoji}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(count / totalEmotions) * 100}%`, background: e.color }}
                      />
                    </div>
                    <span className="w-8 text-right font-mono text-xs text-dim tabular-nums">{count}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
