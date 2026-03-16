import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: false,
  clean: true,
  sourcemap: true,
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
});
