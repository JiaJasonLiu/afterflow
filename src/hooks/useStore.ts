// ─── The single bridge between React and the engine ─────────────────────────
import { useSyncExternalStore } from 'react';
import { getState, subscribe } from '../engine/store.ts';
import type { AppState } from '../engine/types.ts';

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getState);
}
