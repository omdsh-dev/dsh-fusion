import { defineConfig } from 'tsdown'
import { clientBundle } from './tsdown.client.ts'

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      invariant: 'src/invariant.ts',
    },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    tsconfig: 'tsconfig.prepare.json',
  },
  { ...clientBundle('src/client/index.ts'), tsconfig: 'tsconfig.prepare.json' },
])
