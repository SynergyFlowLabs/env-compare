import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Dev-only: the preview proxy serves this app from a *.e2b.app host.
    allowedHosts: ['.e2b.app', 'localhost'],
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // React DOM bundles a resource-preload helper that calls fetch (it is
        // unreachable in this app, and CSP blocks it). Keeping it in its own
        // chunk lets the privacy guard prove that *our* code cannot make a
        // request, rather than excusing the whole bundle.
        manualChunks(id: string) {
          return id.includes('node_modules') ? 'vendor' : undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
});
