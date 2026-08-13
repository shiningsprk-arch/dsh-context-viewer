import { build } from 'esbuild'
import { rmSync } from 'node:fs'

rmSync('dist/main', { recursive: true, force: true })

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  external: ['electron', 'ws'],
  logLevel: 'info',
}

await build({
  ...shared,
  entryPoints: ['electron/main.ts'],
  outfile: 'dist/main/main.js',
  format: 'cjs',
})

await build({
  ...shared,
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist/main/preload.js',
  format: 'cjs',
})

console.log('main + preload built')
