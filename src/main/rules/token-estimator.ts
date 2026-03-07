/**
 * @file src/main/rules/token-estimator.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Word-based token estimate heuristic for AI rule content.
 * Uses the industry-standard approximation of 1.3 tokens per word, which
 * works well for English prose with mixed code snippets and markdown syntax.
 * This is intentionally a simple heuristic — not a real tokenizer — so it
 * stays dependency-free and runs instantly on every keystroke.
 */

/**
 * Estimates the token count for a piece of Markdown content using the
 * word-count heuristic: `ceil(words * 1.3)`.
 *
 * @param content - The raw Markdown text to estimate.
 * @returns The estimated token count, always a positive integer.
 */
export const estimateTokens = (content: string): number => {
  const wordCount = content.split(/\s+/).filter(Boolean).length
  return Math.ceil(wordCount * 1.3)
}
