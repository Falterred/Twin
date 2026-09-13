import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // jsdom renders the whole App and input interaction is render-heavy, so the default
    // 5s budget is too tight for the debounce and recompute invariant tests.
    testTimeout: 20000,
  },
});
