/**
 * @file src/renderer/components/common/icons/ClientIcon.tsx
 *
 * @created 09.03.2026
 * @modified 10.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Displays a branded icon for an AI development tool client.
 * Uses custom PNG images from Icons8 for all clients for consistent style.
 */

import { useState, useEffect, type ComponentType } from 'react'
import type { ReactElement } from 'react'
import type { ClientId } from '@shared/types'
import { cn } from '@/lib/utils'
import { getClientIconSource, type IconSource } from './client-icon-mapping'
import { useTheme } from '@/lib/useTheme'

// ─── Props ──────────────────────────────────────────────────────────────────────

interface ClientIconProps {
  /** The unique identifier of the client (e.g., 'vscode', 'cursor') */
  readonly clientId: ClientId
  /** Size of the icon in pixels. Defaults to 18px (matches ClientCard). */
  readonly size?: number
  /** Additional CSS classes for styling */
  readonly className?: string
  /** Accessibility label. Defaults to "{clientId} icon" */
  readonly ariaLabel?: string
}

// ─── Custom Icon Loader ────────────────────────────────────────────────────────

const CustomIconLoader = ({
  source,
  size,
  className = '',
}: {
  readonly source: Extract<IconSource, { type: 'custom' }>
  readonly size: number
  readonly className?: string
}): ReactElement => {
  // Render custom PNG image from assets
  const { effectiveTheme } = useTheme()
  const path = effectiveTheme === 'dark' ? source.pathDark : source.pathLight
  return (
    <img
      src={path}
      alt={source.name}
      width={size}
      height={size}
      className={cn('object-contain', className)}
      data-testid={`custom-icon-${source.name}`}
      aria-hidden="true"
    />
  )
}

// ─── Fallback Icon ─────────────────────────────────────────────────────────────

const FallbackIcon = ({
  size,
  className = '',
  lucideIconName = 'Code2',
}: {
  readonly size: number
  readonly className?: string
  readonly lucideIconName?: string
}): ReactElement => {
  const [IconComponent, setIconComponent] = useState<ComponentType<{
    size?: number
    className?: string
  }> | null>(null)

  useEffect(() => {
    const loadIcon = async () => {
      try {
        // Dynamically import the specific lucide icon
        if (lucideIconName === 'Code2') {
          const { Code2 } = await import('lucide-react')
          setIconComponent(() => Code2)
        } else if (lucideIconName === 'Monitor') {
          const { Monitor } = await import('lucide-react')
          setIconComponent(() => Monitor)
        } else {
          // Default to Code2
          const { Code2 } = await import('lucide-react')
          setIconComponent(() => Code2)
        }
      } catch (err) {
        console.error('Failed to load fallback icon:', err)
      }
    }

    void loadIcon()
  }, [lucideIconName])

  if (!IconComponent) {
    return (
      <div
        className={cn('bg-surface-3 animate-pulse rounded', className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    )
  }

  return (
    <IconComponent
      size={size}
      className={cn('text-text-secondary', className)}
      aria-hidden="true"
    />
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

/**
 * Displays a branded icon for an AI development tool client.
 *
 * @example
 * ```tsx
 * <ClientIcon clientId="vscode" size={20} className="text-blue-600" />
 * ```
 */
const ClientIcon = ({
  clientId,
  size = 18,
  className = '',
  ariaLabel,
}: ClientIconProps): ReactElement => {
  const source = getClientIconSource(clientId)
  const label = ariaLabel ?? `${clientId} icon`
  const [showFallback, setShowFallback] = useState(false)

  // Render the appropriate icon based on source type
  const renderIcon = () => {
    if (showFallback) {
      return <FallbackIcon size={size} className={className} />
    }

    switch (source.type) {
      case 'custom':
        return <CustomIconLoader source={source} size={size} className={className} />
      case 'fallback':
        return <FallbackIcon size={size} className={className} lucideIconName={source.lucideIcon} />
    }
  }

  const iconElement = renderIcon()

  // If icon loader returns null (failed to load), show fallback
  useEffect(() => {
    if (iconElement === null && !showFallback) {
      setShowFallback(true)
    }
  }, [iconElement, showFallback])

  return (
    <span
      className="inline-flex items-center justify-center"
      role="img"
      aria-label={label}
      data-testid={`client-icon-${clientId}`}
    >
      {showFallback ? <FallbackIcon size={size} className={className} /> : iconElement}
    </span>
  )
}

export { ClientIcon }
export type { ClientIconProps }
