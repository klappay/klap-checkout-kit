import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { 'node/index': 'src/node/index.ts' },
    format: ['esm'],
    dts: true,
    clean: false,
  },
  {
    entry: { 'client/index': 'src/client/index.ts' },
    format: ['esm'],
    dts: true,
    clean: false,
  },
  {
    entry: { 'client/index': 'src/client/index.ts' },
    format: ['iife'],
    globalName: 'KlapCheckoutKit',
    minify: true,
    dts: false,
    clean: false,
  },
])
