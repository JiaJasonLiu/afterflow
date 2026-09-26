import { useEffect, useRef, useState } from 'react';
import { Check, KeyRound, Loader2, Plus, SearchIcon } from 'lucide-react';
import { useStore } from '../hooks/useStore.ts';
import { searchMulti, IMG, type SearchResult } from '../engine/tmdb.ts';
import { addFromSearch } from '../engine/store.ts';

function ResultRow({
  result, inLibrary, onAdded, onOpen,
}: { result: SearchResult; inLibrary: boolean; onAdded: (id: string) => void; onOpen: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(inLibrary);
  const id = `${result.type}-${result.tmdbId}`;

  const add = async () => {
    if (added || busy) return;
    setBusy(true);
    try {
      const item = await addFromSearch(result);
      setAdded(true);
      onAdded(item.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not add this title.');
    } finally {
      setBusy(false);
    }
  };

  const kindLabel = result.isAnime ? 'Anime' : result.type === 'tv' ? 'TV' : 'Movie';

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel p-2.5">
      <button onClick={() => (added ? onOpen(id) : void add())} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {result.posterPath ? (
          <img src={IMG(result.posterPath, 'w92')} alt="" className="h-16 w-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="h-16 w-11 shrink-0 rounded-lg bg-panel-2" />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{result.title}</p>
          <p className="font-mono text-[11px] text-dim">
            {kindLabel}
            {result.year ? ` · ${result.year}` : ''}
          </p>
          <p className="mt-0.5 line-clamp-1 text-xs text-dim">{result.overview}</p>
        </div>
      </button>
      <button
        onClick={() => void add()}
        disabled={added || busy}
        aria-label={added ? 'In library' : `Add ${result.title}`}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 ${
          added ? 'bg-panel-2 text-ember' : 'glow-gradient text-ink'
        }`}
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : added ? <Check size={18} /> : <Plus size={18} />}
      </button>
    </div>
  );
}

export function SearchScreen({
  onOpenItem, onGoSettings,
}: { onOpenItem: (id: string) => void; onGoSettings: () => void }) {
  const { apiKey, items } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q || !apiKey) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const mySeq = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await searchMulti(apiKey, q);
        if (seq.current !== mySeq) return;
        setResults(res);
        setError('');
      } catch (e) {
        if (seq.current !== mySeq) return;
        setError(e instanceof Error ? e.message : 'Search failed.');
      } finally {
        if (seq.current === mySeq) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, apiKey]);

  if (!apiKey) {
    return (
      <div className="flex flex-col items-center px-6 pt-24 text-center">
        <KeyRound size={36} className="text-dim" />
        <p className="mt-4 text-lg font-semibold">One quick setup step</p>
        <p className="mt-1 max-w-70 text-sm text-dim">
          Search is powered by TMDB. Add your free API key in Settings and everything unlocks.
        </p>
        <button onClick={onGoSettings} className="glow-gradient mt-5 rounded-full px-5 py-2.5 font-semibold text-ink">
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="px-4">
      <header className="pt-6 pb-3">
        <p className="font-mono text-[11px] tracking-[0.25em] text-dim uppercase">Add to library</p>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
      </header>
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-3.5 py-3">
        <SearchIcon size={18} className="shrink-0 text-dim" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Shows, anime, movies…"
          className="w-full bg-transparent outline-none placeholder:text-dim"
          enterKeyHint="search"
        />
        {searching && <Loader2 size={18} className="shrink-0 animate-spin text-dim" />}
      </div>

      {error && <p className="mt-3 text-sm text-rose">{error}</p>}

      <div className="mt-4 flex flex-col gap-2.5 pb-28">
        {results.map((r) => (
          <ResultRow
            key={`${r.type}-${r.tmdbId}`}
            result={r}
            inLibrary={Boolean(items[`${r.type}-${r.tmdbId}`])}
            onAdded={() => undefined}
            onOpen={onOpenItem}
          />
        ))}
        {!searching && query.trim() && results.length === 0 && !error && (
          <p className="mt-10 text-center text-sm text-dim">No matches. Try a different spelling.</p>
        )}
        {!query.trim() && (
          <p className="mt-10 text-center text-sm text-dim">
            Type to search TMDB. Tap <span className="text-ember">+</span> to add a title — episodes download for offline tracking.
          </p>
        )}
      </div>
    </div>
  );
}
