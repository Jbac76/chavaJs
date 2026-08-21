import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Resolve a path relative to this file, ESM-style (no __dirname in ESM).
const resolve = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('./resources/js'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    // Emit a manifest the chavaJs server uses to resolve hashed assets,
    // mirroring how the laravel-vite-plugin manifest works.
    manifest: true,
    outDir: 'public/build',
    rollupOptions: {
      input: 'resources/js/app.tsx',
    },
  },
});
