import { defineConfig } from 'tsdown'

const clientExternal = [
  'react',
  'react/jsx-runtime',
]

export default defineConfig({
  entry: {
    client: 'src/client/index.tsx',
  },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2022',
  entryFileNames: '[name].js',
  outExtensions: () => ({ js: '.js' }),
  external: clientExternal,
  noExternal: ['zod'],
  sourcemap: false,
  dts: false,
  clean: false,
})
