import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages ではリポジトリ名がパスに入るため、相対パスでビルドする。
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
