import { useRef, useState } from 'react';
import { Download, ExternalLink, Trash2, Upload } from 'lucide-react';
import { useStore } from '../hooks/useStore.ts';
import { clearAll, exportJson, importJson, setApiKey } from '../engine/store.ts';

export function SettingsScreen() {
  const { apiKey, items } = useStore();
  const [draft, setDraft] = useState(apiKey);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    setApiKey(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `afterglow-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      const count = await importJson(await file.text());
      setMessage(`Imported ${count} titles.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed.');
    }
  };

  return (
    <div className="px-4 pb-28">
      <header className="pt-6 pb-4">
        <p className="font-mono text-[11px] tracking-[0.25em] text-dim uppercase">Afterglow</p>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </header>

      <div className="rounded-2xl border border-line bg-panel p-4">
        <p className="font-semibold">TMDB API key</p>
        <p className="mt-1 text-sm text-dim">
          Powers search and episode data. Free from themoviedb.org — either the v3 key or the v4 read
          token works. Stored only on this device.
        </p>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste your key"
          className="mt-3 w-full rounded-xl border border-line bg-panel-2 p-3 font-mono text-sm outline-none placeholder:font-sans placeholder:text-dim focus:border-ember"
        />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={save} className="glow-gradient rounded-full px-5 py-2 font-semibold text-ink transition-transform active:scale-95">
            {saved ? 'Saved ✓' : 'Save key'}
          </button>
          <a
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-sm text-dim underline underline-offset-2"
          >
            Get a key <ExternalLink size={13} />
          </a>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-panel p-4">
        <p className="font-semibold">Your data</p>
        <p className="mt-1 text-sm text-dim">
          {Object.keys(items).length} titles live in this browser's storage. Back up or move devices with
          a JSON export.
        </p>
        <div className="mt-3 flex gap-2">
          <button onClick={doExport} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold">
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-semibold"
          >
            <Upload size={16} /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        {message && <p className="mt-2 text-sm text-ember">{message}</p>}
      </div>

      <div className="mt-3 rounded-2xl border border-line bg-panel p-4">
        <p className="font-semibold text-rose">Danger zone</p>
        <button
          onClick={() => {
            if (confirm('Delete every title, check-in, and note? This cannot be undone.')) void clearAll();
          }}
          className="mt-3 flex items-center gap-2 rounded-xl border border-rose/40 px-4 py-2.5 text-sm font-semibold text-rose"
        >
          <Trash2 size={16} /> Clear all data
        </button>
      </div>

      <p className="mt-6 text-center font-mono text-[11px] text-dim">
        Afterglow · local-first · data never leaves your device (except TMDB lookups)
      </p>
    </div>
  );
}
