/**
 * @file src/renderer/lib/utils.ts
 *
 * @created 07.03.2026
 * @modified 07.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Utility functions for the renderer. The `cn` helper merges
 * Tailwind class names together, resolving conflicts correctly using
 * clsx and tailwind-merge. All shadcn/ui components use this internally.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges multiple class name inputs into a single deduplicated string,
 * resolving Tailwind utility conflicts using tailwind-merge.
 *
 * @param inputs - Any number of class name values (strings, arrays, objects)
 * @returns A single merged class name string
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
