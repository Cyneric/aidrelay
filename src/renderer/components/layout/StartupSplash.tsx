/**
 * @file src/renderer/components/layout/StartupSplash.tsx
 *
 * @description Full-screen startup splash overlay with a milestone progress
 * bar and loading text.
 */

import logo from '@/assets/branding/logo.png'

interface StartupSplashProps {
  readonly progress: number
  readonly message: string
}

export const StartupSplash = ({ progress, message }: StartupSplashProps) => (
  <div
    className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-sm"
    data-testid="startup-splash"
    role="status"
    aria-live="polite"
  >
    <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xl">
      <div className="mb-6 flex items-center gap-3">
        <img src={logo} alt="aidrelay logo" className="h-10 w-10 rounded-md" />
        <div>
          <p className="text-base font-semibold text-foreground">aidrelay</p>
          <p className="text-xs text-muted-foreground">Initializing workspace</p>
        </div>
      </div>

      <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
          data-testid="startup-splash-progress"
        />
      </div>

      <p className="text-sm text-muted-foreground" data-testid="startup-splash-message">
        {message}
      </p>
    </div>
  </div>
)
