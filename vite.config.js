import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// After a build, list every file so the app can save itself for offline use
function offlineManifest() {
  let dist;
  return {
    name: 'offline-manifest',
    apply: 'build',
    configResolved(config) { dist = path.resolve(config.root, config.build.outDir); },
    closeBundle() {
      const files = []; let bytes = 0;
      const walk = (dir) => {
        for (const f of fs.readdirSync(dir)) {
          const p = path.join(dir, f);
          const st = fs.statSync(p);
          if (st.isDirectory()) walk(p);
          else if (!/sw\.js$|files\.json$/.test(f)) { files.push(path.relative(dist, p).split(path.sep).join('/')); bytes += st.size; }
        }
      };
      walk(dist);
      const version = Date.now().toString(36);
      fs.writeFileSync(path.join(dist, 'files.json'), JSON.stringify({ version, bytes, files }));
    },
  };
}

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000, assetsInlineLimit: 0 },
  plugins: [offlineManifest()],
});
