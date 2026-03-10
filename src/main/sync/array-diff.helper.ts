/**
 * @file src/main/sync/array-diff.helper.ts
 *
 * @created 10.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <aidrelay@proton.me>
 * @copyright 2026
 *
 * @description Generic array diff utility for comparing two arrays of objects
 * by a unique key. Returns added, removed, and modified items.
 */

export interface ArrayDiff<T> {
  readonly added: readonly T[]
  readonly removed: readonly T[]
  readonly modified: readonly T[]
  readonly unchanged: readonly T[]
}

/**
 * Computes diff between two arrays of objects using a key function.
 * Objects are considered equal if their keys match and their JSON string
 * representation (excluding any internal metadata like `id`) is identical.
 *
 * @param before - Previous array.
 * @param after - New array.
 * @param keyFn - Function returning a unique identifier for each item.
 * @returns Diff object with four categories.
 */
export const diffArrays = <T>(
  before: readonly T[],
  after: readonly T[],
  keyFn: (item: T) => string,
): ArrayDiff<T> => {
  const beforeMap = new Map<string, T>()
  const afterMap = new Map<string, T>()

  for (const item of before) beforeMap.set(keyFn(item), item)
  for (const item of after) afterMap.set(keyFn(item), item)

  const added: T[] = []
  const removed: T[] = []
  const modified: T[] = []
  const unchanged: T[] = []

  const allKeys = new Set<string>([...beforeMap.keys(), ...afterMap.keys()])

  for (const key of allKeys) {
    const beforeItem = beforeMap.get(key)
    const afterItem = afterMap.get(key)

    if (beforeItem === undefined && afterItem !== undefined) {
      added.push(afterItem)
    } else if (beforeItem !== undefined && afterItem === undefined) {
      removed.push(beforeItem)
    } else if (beforeItem !== undefined && afterItem !== undefined) {
      const beforeJson = JSON.stringify(beforeItem)
      const afterJson = JSON.stringify(afterItem)
      if (beforeJson === afterJson) {
        unchanged.push(afterItem)
      } else {
        modified.push(afterItem)
      }
    }
  }

  return { added, removed, modified, unchanged }
}
