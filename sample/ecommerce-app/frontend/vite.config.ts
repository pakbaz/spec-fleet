import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const backendUrl = process.env.VITE_DEV_BACKEND_URL ?? 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          msal: ['@azure/msal-browser', '@azure/msal-react'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: backendUrl, changeOrigin: true },
      '/auth': { target: backendUrl, changeOrigin: true },
      '/health': { target: backendUrl, changeOrigin: true },
    },
  },
});
