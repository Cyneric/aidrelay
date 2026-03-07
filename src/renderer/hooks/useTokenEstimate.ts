/**
 * @file src/renderer/hooks/useTokenEstimate.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Debounced hook that returns a live token estimate for a
 * Markdown content string. Calls `window.api.rulesEstimateTokens` via IPC
 * after a 300 ms idle period. Falls back to the same word-count heuristic
 * used in the main process when the IPC call fails or is unavailable.
 */

import { useState, useEffect } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Local fallback token estimator.
 * Mirrors `estimateTokens` in `src/main/rules/token-estimator.ts`.
 */
const estimateLocally = (content: string): number => {
  const wordCount = content.split(/\s+/).filter(Boolean).length
  return Math.ceil(wordCount * 1.3)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns a debounced token estimate for the given Markdown content.
 *
 * - Debounces IPC calls by 300 ms to avoid flooding the main process on every
 *   keystroke.
 * - Falls back to the local word-count heuristic if the IPC call throws.
 * - Returns 0 for empty content immediately without waiting for the debounce.
 *
 * @param content - Raw Markdown text to estimate.
 * @returns Estimated token count (integer, always ≥ 0).
 */
const useTokenEstimate = (content: string): number => {
  const [estimate, setEstimate] = useState(() => estimateLocally(content))

  useEffect(() => {
    if (!content.trim()) {
      setEstimate(0)
      return
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await window.api.rulesEstimateTokens(content)
          setEstimate(result)
        } catch {
          setEstimate(estimateLocally(content))
        }
      })()
    }, 300)

    return () => clearTimeout(timer)
  }, [content])

  return estimate
}

export { useTokenEstimate }
