/**
 * @file vitest.config.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Vitest configuration using the modern `test.projects` field.
 * Defines two separate test environments: `node` for main/preload process
 * code, and `jsdom` for React renderer components.
 */

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const root = import.meta.dirname

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['node_modules/**'],
        },
        resolve: {
          alias: {
            '@shared': resolve(root, 'src/shared'),
            '@main': resolve(root, 'src/main'),
          },
        },
      },
      {
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: [
            'src/renderer/**/__tests__/**/*.{test,spec}.{ts,tsx}',
            'src/shared/**/__tests__/**/*.{test,spec}.{ts,tsx}',
          ],
          exclude: ['node_modules/**'],
          setupFiles: ['src/renderer/__tests__/setup.ts'],
          globals: true,
        },
        resolve: {
          alias: {
            '@': resolve(root, 'src/renderer'),
            '@shared': resolve(root, 'src/shared'),
            '@renderer': resolve(root, 'src/renderer'),
          },
        },
      },
    ],
  },
})
