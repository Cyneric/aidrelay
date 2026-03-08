/**
 * @file electron.vite.config.ts
 *
 * @created 07.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Unified electron-vite build configuration. Handles the three
 * build targets (main, preload, renderer) with shared path aliases and
 * Tailwind CSS v4 integration via the official Vite plugin.
 */

import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin, bytecodePlugin } from 'electron-vite'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  // Load all .env variables (no prefix filter) so we can forward non-VITE_ vars
  // to the main process bundle via `define`. Vite's .env handling only auto-exposes
  // VITE_-prefixed vars in the renderer; main process vars must be injected explicitly.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    main: {
      // bytecodePlugin compiles the licensing module to V8 bytecode in production
      // builds, raising the reverse-engineering barrier for license-checking code.
      // It is intentionally left out of the preload and renderer — only the main
      // process hosts sensitive license logic.
      plugins: [externalizeDepsPlugin(), bytecodePlugin()],
      define: {
        // Forward the dev-pro override flag so it is readable via process.env in
        // the compiled main-process bundle.
        'process.env.AIDRELAY_DEV_PRO': JSON.stringify(env['AIDRELAY_DEV_PRO'] ?? ''),
      },
      resolve: {
        alias: {
          '@shared': resolve('src/shared'),
          '@main': resolve('src/main'),
        },
      },
      build: {
        outDir: 'out/main',
      },
    },

    preload: {
      plugins: [externalizeDepsPlugin()],
      resolve: {
        alias: {
          '@shared': resolve('src/shared'),
        },
      },
      build: {
        outDir: 'out/preload',
      },
    },

    renderer: {
      root: 'src/renderer',
      plugins: [tailwindcss(), react()],
      resolve: {
        alias: {
          '@': resolve('src/renderer'),
          '@shared': resolve('src/shared'),
          '@renderer': resolve('src/renderer'),
        },
      },
      build: {
        outDir: 'out/renderer',
        rollupOptions: {
          input: {
            index: resolve('src/renderer/index.html'),
          },
        },
      },
    },
  }
})
