import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        math: resolve(__dirname, 'src/math/index.ts'),
        shapes: resolve(__dirname, 'src/shapes/index.ts'),
        dynamics: resolve(__dirname, 'src/dynamics/index.ts'),
      },
      formats: ['es'],
    },
    target: 'esnext',
    minify: false,
  },
  plugins: [dts()],
});
