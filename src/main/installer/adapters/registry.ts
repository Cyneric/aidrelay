/**
 * @file src/main/installer/adapters/registry.ts
 *
 * @created 09.03.2026
 * @modified 09.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Central registry of all installation adapters. The installer
 * service looks up adapters here rather than importing them directly.
 */

import type { InstallAdapterType } from '@shared/types'
import type { InstallAdapter } from './types'
import { wingetAdapter } from './winget.adapter'
import { npmAdapter } from './npm.adapter'
import { pipAdapter } from './pip.adapter'
import { cargoAdapter } from './cargo.adapter'
import { dockerAdapter } from './docker.adapter'
import { executableAdapter } from './executable.adapter'

/**
 * All registered installation adapters indexed by `InstallAdapterType`.
 * Use `ADAPTERS.get(type)` to retrieve an adapter in the installer service.
 */
export const ADAPTERS: Readonly<Map<InstallAdapterType, InstallAdapter>> = new Map<
  InstallAdapterType,
  InstallAdapter
>([
  ['winget', wingetAdapter],
  ['npm', npmAdapter],
  ['pip', pipAdapter],
  ['cargo', cargoAdapter],
  ['docker', dockerAdapter],
  ['executable', executableAdapter],
])

/**
 * Ordered list of all adapter types, used when iterating over all adapters
 * (e.g., for runtime detection).
 */
export const ADAPTER_TYPES: readonly InstallAdapterType[] = [
  'winget',
  'npm',
  'pip',
  'cargo',
  'docker',
  'executable',
]
