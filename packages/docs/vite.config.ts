import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Set DOCS_BASE for subpath deploys (GitHub Pages uses /seaq/)
  base: process.env.DOCS_BASE || '/',
  // Off the common dev-port ranges (3000/5173/8080) so this doesn't collide
  // with other local Vite projects.
  server: { port: 5417 },
  preview: { port: 5417 },
});
