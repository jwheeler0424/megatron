import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron';
import { builtinModules } from 'module';
import path from 'path';

export default defineConfig(({ command }) => ({
  base: './',
  build: {
    outDir: path.resolve(__dirname, '../dist-electron'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'node18'
  },
  plugins: [
    electron([
      // main process bundle
      {
        entry: 'electron/main.ts',
        // customize the internal vite build used for the main bundle
        vite: {
          build: {
            target: 'node18',
            rollupOptions: {
              external: [...builtinModules]
            }
          }
        }
      },
      // preload bundle
      {
        entry: 'electron/preload.ts',
        vite: {
          build: {
            target: 'es2020'
          }
        }
      }
    ])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '..')
    }
  }
}));