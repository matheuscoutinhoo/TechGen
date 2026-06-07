/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
   plugins: [react()],
   resolve: {
      alias: {
         '@': path.resolve(projectRoot, './src'),
      },
   },
   server: {
      port: 5173,
   },
   test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      css: true,
      coverage: {
         provider: 'v8',
         reporter: ['text', 'html'],
         include: ['src/**/*.{ts,tsx}'],
         exclude: ['src/main.tsx', 'src/**/*.test.{ts,tsx}', 'src/types/**'],
      },
   },
});
