// Runs both headless test suites through esbuild bundles.
import { execSync } from 'node:child_process';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
run('npx esbuild tests/engine.test.ts --bundle --format=esm --platform=node --outfile=tests/.engine.mjs --log-level=error');
run('node tests/.engine.mjs');
run('npx esbuild tests/render.test.tsx --bundle --format=esm --platform=node --jsx=automatic --external:jsdom --external:fake-indexeddb --outfile=tests/.render.mjs --log-level=error');
run('node tests/.render.mjs');
run(process.platform === 'win32' ? 'del tests\\.engine.mjs tests\\.render.mjs' : 'rm -f tests/.engine.mjs tests/.render.mjs');
