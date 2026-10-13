// Tiny no-install web server for the built app (the dist folder).
// Run:  node serve.mjs        then open the address it prints on the iPad (same Wi-Fi).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const port = Number(process.env.PORT) || 8080;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml',
};

if (!fs.existsSync(path.join(root, 'index.html'))) {
  console.error('No dist folder yet. Run:  npm install && npm run build');
  process.exit(1);
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(root, urlPath);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => {
  console.log('\n  Space Explorer is running.\n');
  console.log(`  On this Mac:   http://localhost:${port}`);
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const n of nets || []) if (n.family === 'IPv4' && !n.internal) console.log(`  On the iPad:   http://${n.address}:${port}   (same Wi-Fi)`);
  }
  console.log('\n  Press Ctrl+C to stop.\n');
});
