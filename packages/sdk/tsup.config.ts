import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/ai.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  outDir: 'dist',
  external: ['@hashgraph/sdk', '@langchain/core', '@langchain/openai', 'langchain', 'zod'],
  treeshake: true,
  esbuildOptions: (options) => {
    options.platform = 'neutral';
  },
});
