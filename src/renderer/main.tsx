/**
 * @file src/renderer/main.tsx
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description React renderer entry point. Mounts the root App component
 * inside StrictMode to catch potential issues early during development.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/index.css'
import './i18n/index'
import './lib/monaco/setup'
import { App } from './App'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found in the DOM. Check index.html.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
