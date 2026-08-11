import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// When deployed to GitHub Pages the site is served from
//   https://<org>.github.io/<repo>/
// so all emitted asset URLs and the SPA's <base href> must include the
// repo name as a prefix. In dev (vite serve) we keep '/' so localhost
// behaviour matches expectations.
const repoName = 'dea-web-viewer';
const base = process.env.GITHUB_PAGES ? `/${repoName}/` : '/';

export default defineConfig(() => {
  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // /data/* and /assets/* are absolute paths from the SPA root;
      // base already handles the repo-name prefix.
      outDir: 'dist',
      sourcemap: false,
    },
  };
});