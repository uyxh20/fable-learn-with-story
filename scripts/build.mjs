import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { build, transform } from 'esbuild';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });
await build({
  stdin: { contents: "import React from 'react'; import * as ReactDOM from 'react-dom/client'; window.React = React; window.ReactDOM = ReactDOM;", resolveDir: process.cwd() },
  bundle: true, minify: true, format: 'iife', outfile: 'dist/assets/react.js',
  define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'linked'
});
let html = await readFile('src/index.html', 'utf8');
let count = 0;
const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
for (const [whole, attrs, content] of scripts) {
  if (attrs.includes('text/plain')) continue;
  const src = attrs.match(/src="([^"]+)"/)?.[1];
  if (src?.startsWith('https://')) {
    html = html.replace(whole, src.includes('/react@') ? '<script src="/assets/react.js"></script>' : '');
    continue;
  }
  const code = src ? await readFile(`src/${src.split('?')[0]}`, 'utf8') : content;
  const result = await transform(code, { loader: 'jsx', minify: true, target: 'es2020', legalComments: 'none' });
  const file = `assets/script-${count++}.js`;
  await writeFile(`dist/${file}`, result.code);
  html = html.replace(whole, `<script src="/${file}"></script>`);
}
await writeFile('dist/index.html', html);
console.log(`Built Fable with ${count} local scripts and bundled React.`);
