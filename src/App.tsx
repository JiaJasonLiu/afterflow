import { useState } from 'react';
import { BarChart3, LibraryBig, Search, Settings } from 'lucide-react';
import { useStore } from './hooks/useStore.ts';
import { LibraryScreen } from './components/LibraryScreen.tsx';
import { SearchScreen } from './components/SearchScreen.tsx';
import { DetailScreen } from './components/DetailScreen.tsx';
import { StatsScreen } from './components/StatsScreen.tsx';
import { SettingsScreen } from './components/SettingsScreen.tsx';

type Tab = 'library' | 'search' | 'stats' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof LibraryBig }[] = [
  { id: 'library', label: 'Library', icon: LibraryBig },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const { ready } = useStore();
  const [tab, setTab] = useState<Tab>('library');
  const [openId, setOpenId] = useState<string | null>(null);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="glow-text animate-pulse text-2xl font-bold">Afterglow</p>
      </div>
    );
  }

  const openItem = (id: string) => setOpenId(id);

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      {openId ? (
        <DetailScreen id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <>
          {tab === 'library' && <LibraryScreen onOpenItem={openItem} onGoSearch={() => setTab('search')} />}
          {tab === 'search' && <SearchScreen onOpenItem={openItem} onGoSettings={() => setTab('settings')} />}
          {tab === 'stats' && <StatsScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </>
      )}

      {!openId && (
        <nav className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto flex max-w-md justify-around border-t border-line bg-panel/90 px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.6rem)] backdrop-blur-md">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className="flex w-16 flex-col items-center gap-0.5 transition-transform active:scale-90"
                >
                  <Icon size={22} className={active ? 'text-ember' : 'text-dim'} strokeWidth={active ? 2.4 : 2} />
                  <span className={`text-[10px] font-semibold ${active ? 'glow-text' : 'text-dim'}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
