import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'

// Exercise the native code in a production Electron bundle before app-shell wiring exists.
export default defineConfig({ main: { build: { lib: { entry: resolve('src/main/native/smoke.ts'), formats: ['cjs'], fileName: () => 'native-smoke.cjs' } } } })
