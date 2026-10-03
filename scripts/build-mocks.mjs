import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { build } from 'esbuild';

// Deliberately separate from dist: normal builds and deployments exclude all mocks.
const out = '.local-preview/public';
await mkdir(`${out}/mocks`, { recursive: true });
await cp('dist', out, { recursive: true });
await cp('mockups/index.html', `${out}/mocks/index.html`);
await cp('mockups/styles.css', `${out}/mocks/styles.css`);
await cp('src/story-client.js', `${out}/mocks/story-client.js`);
const source = await readFile('src/index.html', 'utf8');
const model = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x => x[1]).find(x => x.includes('/* FABLE — bilingual content model'));
if (!model) throw new Error('Sample content model not found');
await writeFile(`${out}/mocks/model.js`, model);
await build({ entryPoints: ['mockups/app.jsx'], bundle: true, minify: false, outfile: `${out}/mocks/app.js`, define: { 'process.env.NODE_ENV': '"development"' } });
console.log('Local design playground: http://127.0.0.1:8788/mocks/');
