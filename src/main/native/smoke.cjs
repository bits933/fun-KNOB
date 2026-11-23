// Uses the bundler already installed by Vite; no extra package or TS runtime needed.
const path = require('node:path')
const fs = require('node:fs/promises')
;(async () => {
  const { rolldown } = await import('rolldown')
  const target = path.join(__dirname, '.smoke-run.cjs')
  const build = await rolldown({ input: path.join(__dirname, 'smoke.ts'), external: [/^node:/, 'koffi'] })
  try {
    await build.write({ file: target, format: 'cjs' })
    require(target)
  } finally { await build.close(); await fs.unlink(target).catch(() => {}) }
})().catch(error => { console.error(error); process.exitCode = 1 })
