// Builds the copy that runs as a private claude.ai link (an Artifact), e.g. to try it on a phone.
// That host only serves web file types (no .glb) and wraps the page in its own <html>/<head>/<body>, so:
//  - models ship as base64 text (models/x.glb.txt), decoded by loadGLTF in src/scene/bodies3d.js
//  - the page is index.html's body with the title, script and stylesheet tags on top
//  - no service worker or offline files (a shared link can't use them)
// Output: dist-link/space-explorer.html (the page), the files next to it, and dist-link.json (what to publish).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-link');
process.env.VITE_PACKED_MODELS = '1';
await build({ root, logLevel: 'warn', build: { outDir: out, emptyOutDir: true } });

const models = path.join(out, 'models');
for (const f of fs.readdirSync(models)) {
  if (!f.endsWith('.glb')) continue;
  fs.writeFileSync(path.join(models, `${f}.txt`), fs.readFileSync(path.join(models, f)).toString('base64'));
  fs.rmSync(path.join(models, f));
}
for (const f of ['sw.js', 'files.json', 'manifest.webmanifest', 'icon.png']) fs.rmSync(path.join(out, f), { force: true });

const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const lines = head.split('\n').map((l) => l.trim());
const title = lines.filter((l) => l.startsWith('<title>'));
const assets = lines.filter((l) => /rel="stylesheet"|<script type="module"/.test(l));
// the host's page starts white; paint it space-black straight away so there's no white flash
const early = '<style>html,body{margin:0;background:#02040a;color:#eef4ff}</style>';
fs.writeFileSync(path.join(out, 'space-explorer.html'), [...title, early, ...assets, body.trim()].join('\n') + '\n');
fs.rmSync(path.join(out, 'index.html'));

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name !== 'space-explorer.html') files.push(path.relative(out, p).split(path.sep).join('/'));
  }
};
walk(out);
files.sort();
const sizes = files.map((f) => fs.statSync(path.join(out, f)).size);
const total = sizes.reduce((a, b) => a + b, 0);
fs.writeFileSync(path.join(root, 'dist-link.json'), JSON.stringify(files.map((p) => ({ path: p }))));
console.log(`${files.length} files, ${(total / 1e6).toFixed(1)} MB, largest ${(Math.max(...sizes) / 1e6).toFixed(1)} MB`);
