
import path from 'path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ["**/*.service.ts"],
      provider: "v8"
    },
    include: ["**/*.spec.ts"],
    globals: true,
    root: './',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [swc.vite()],
});
