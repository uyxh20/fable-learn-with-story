import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build, transform } from 'esbuild';

// Production build: one hashed vendor file (React), one hashed app bundle, a tiny theme
// bootstrap, inlined CSS and self-hosted fonts. Local-only readers ship as a separate
// module that the app imports on localhost. Dev-only tooling never reaches dist/.
const hash = code => createHash('sha256').update(code).digest('hex').slice(0, 10);
const minify = async (code, loader = 'js') => (await transform(code, { loader, minify: true, target: 'es2020', legalComments: 'none' })).code;

await rm('dist', { recursive: true, force: true });
await mkdir('dist/assets', { recursive: true });
await cp('public', 'dist', { recursive: true });

const react = await build({
  stdin: { contents: "import React from 'react'; import * as ReactDOM from 'react-dom/client'; window.React = React; window.ReactDOM = ReactDOM;", resolveDir: process.cwd() },
  bundle: true, minify: true, format: 'iife', write: false, outfile: 'dist/assets/react.js',
  define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'linked',
});
const reactJS = react.outputFiles.find(f => f.path.endsWith('react.js')).text;
const reactLegal = react.outputFiles.find(f => f.path.endsWith('.LEGAL.txt'))?.text || '';
const reactName = `react.${hash(reactJS)}.js`;
await writeFile(`dist/assets/${reactName}`, reactJS.replace('react.js.LEGAL.txt', `${reactName}.LEGAL.txt`));
if (reactLegal) await writeFile(`dist/assets/${reactName}.LEGAL.txt`, reactLegal);

let html = await readFile('src/index.html', 'utf8');
const app = [], local = [];
let boot = '';
for (const [whole, attrs, content] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (attrs.includes('text/plain')) continue;
  const src = attrs.match(/src="([^"]+)"/)?.[1];
  html = html.replace(whole, '');
  if (src?.startsWith('https://')) continue;
  const code = src ? await readFile(`src/${src.split('?')[0]}`, 'utf8') : content;
  if (code.includes('// tweaks-panel.jsx')) continue;          // design-time tooling, never shipped
  if (attrs.includes('data-boot')) { boot = code; continue; }   // runs before first paint
  const target = src?.includes('popup-readers') ? local : app;
  target.push((await transform(code, { loader: 'jsx', target: 'es2020', legalComments: 'none' })).code);
}
const appJS = await minify(app.join('\n;\n')), localJS = await minify(local.join('\n;\n')), bootJS = await minify(boot);
const appName = `app.${hash(appJS)}.js`, localName = `local-readers.${hash(localJS)}.js`, bootName = `boot.${hash(bootJS)}.js`;
await writeFile(`dist/assets/${appName}`, appJS.replace('__LOCAL_READERS__', `/assets/${localName}`));
await writeFile(`dist/assets/${localName}`, localJS);
await writeFile(`dist/assets/${bootName}`, bootJS);

const fonts = await readFile('src/fonts.css', 'utf8');
const homeCSS = await readFile('public/assets/fable-home.css', 'utf8');
await rm('dist/assets/fable-home.css', { force: true });
html = html
  .replace('<link rel="stylesheet" href="/assets/fable-home.css">', `<style>${fonts}${await minify(homeCSS, 'css')}</style>`)
  .replace(/@import url\('https:\/\/fonts\.googleapis\.com[^']*'\);\n?/, '')
  .replace('</head>', `  <script src="/assets/${bootName}"></script>\n  <script defer src="/assets/${reactName}"></script>\n  <script defer src="/assets/${appName}"></script>\n</head>`)
  .replace(/\n{3,}/g, '\n\n');
await writeFile('dist/index.html', html);
console.log(`Built Fable: ${appName} (${(appJS.length / 1024).toFixed(0)} KB), ${reactName} (${(reactJS.length / 1024).toFixed(0)} KB), ${localName} local-only.`);
