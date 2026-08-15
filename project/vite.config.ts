import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { miniRedisServerPlugin } from './src/server/plugin';

export default defineConfig({
  plugins: [react(), miniRedisServerPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: [],
  },
  build: {
    outDir: 'dist',
  },
});
