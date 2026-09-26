// jsdom smoke test: boot the store with a fake IndexedDB and mount the app.
import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
(globalThis as any).URL.createObjectURL = () => 'blob:fake';

const { createRoot } = await import('react-dom/client');
const React = await import('react');
const { default: App } = await import('../src/App.tsx');
const { init, setApiKey, getState } = await import('../src/engine/store.ts');

await init();
setApiKey('test-key');

const root = createRoot(document.getElementById('root')!);
await new Promise<void>((resolve) => {
  root.render(React.createElement(App));
  setTimeout(resolve, 50);
});

const html = document.body.innerHTML;
if (!html.includes('Afterglow')) throw new Error('App shell did not render');
if (!html.includes('Nothing here yet')) throw new Error('Empty library state missing');
if (!html.includes('Library') || !html.includes('Stats')) throw new Error('Bottom nav missing');
if (getState().apiKey !== 'test-key') throw new Error('Store not persisting api key in state');

console.log('✓ jsdom render smoke test passed');
