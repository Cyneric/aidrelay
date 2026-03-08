/**
 * @file src/renderer/lib/electron.d.ts
 *
 * @created 08.03.2026
 * @modified 08.03.2026
 *
 * @author Christian Blank <christianblank91@protonmail.com>
 * @copyright 2026
 *
 * @description Augments React's CSSProperties interface with the
 * `-webkit-app-region` CSS property used by Electron to designate
 * draggable and non-draggable regions in the custom title bar.
 */

import 'react'

declare module 'react' {
  interface CSSProperties {
    /**
     * Electron-specific CSS property that marks an element as a drag region
     * (`'drag'`) or explicitly opts it out of dragging (`'no-drag'`). Applied
     * inline on the title bar root and on interactive control buttons inside it.
     */
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}
