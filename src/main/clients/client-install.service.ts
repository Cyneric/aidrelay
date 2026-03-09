/**
 * @file src/main/clients/client-install.service.ts
 *
 * @description In-app client installer for Windows. Runs non-interactive
 * package-manager commands with fallback order winget -> choco -> npm and
 * returns structured attempt history.
 */

import spawn from 'cross-spawn'
import log from 'electron-log'
import type { ClientInstallProgressPayload } from '@shared/channels'
import type {
  ClientId,
  ClientInstallAttempt,
  ClientInstallFailureReason,
  ClientInstallResult,
  InstallManager,
} from '@shared/types'
import { hasWindowsCommandOnPath } from './windows-detection.util'

type AutomaticInstallManager = Exclude<InstallManager, 'manual'>

interface InstallCommand {
  readonly manager: AutomaticInstallManager
  readonly command: string
  readonly args: readonly string[]
}

interface ClientInstallDefinition {
  readonly docsUrl: string
  readonly attempts: readonly InstallCommand[]
  readonly manualOnly?: boolean
}

interface InstallExecutionResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly error?: string
}

type InstallProgressReporter = (payload: ClientInstallProgressPayload) => void

const INSTALL_DEFINITIONS: Readonly<Record<ClientId, ClientInstallDefinition>> = {
  cursor: {
    docsUrl: 'https://www.cursor.com/downloads',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'Anysphere.Cursor',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'cursoride', '-y', '--no-progress'],
      },
    ],
  },
  'claude-desktop': {
    docsUrl: 'https://claude.ai/download',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'Anthropic.Claude',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'claude', '-y', '--no-progress'],
      },
    ],
  },
  'claude-code': {
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'Anthropic.ClaudeCode',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'claude-code', '-y', '--no-progress'],
      },
      {
        manager: 'npm',
        command: 'npm',
        args: ['install', '--global', '@anthropic-ai/claude-code', '--yes', '--silent'],
      },
    ],
  },
  vscode: {
    docsUrl: 'https://code.visualstudio.com/download',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'Microsoft.VisualStudioCode',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'vscode', '-y', '--no-progress'],
      },
    ],
  },
  'vscode-insiders': {
    docsUrl: 'https://code.visualstudio.com/insiders',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'Microsoft.VisualStudioCode.Insiders',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'vscode-insiders', '-y', '--no-progress'],
      },
    ],
  },
  windsurf: {
    docsUrl: 'https://codeium.com/windsurf',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'Codeium.Windsurf',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'windsurf', '-y', '--no-progress'],
      },
    ],
  },
  zed: {
    docsUrl: 'https://zed.dev/download',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'ZedIndustries.Zed',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'zed', '-y', '--no-progress'],
      },
    ],
  },
  jetbrains: {
    docsUrl: 'https://www.jetbrains.com/toolbox-app/',
    attempts: [],
    manualOnly: true,
  },
  'codex-cli': {
    docsUrl: 'https://github.com/openai/codex',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'OpenAI.Codex',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'codex', '-y', '--no-progress'],
      },
      {
        manager: 'npm',
        command: 'npm',
        args: ['install', '--global', '@openai/codex', '--yes', '--silent'],
      },
    ],
  },
  'codex-gui': {
    docsUrl: 'https://apps.microsoft.com/detail/9PLM9XGG6VKS',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          '9PLM9XGG6VKS',
          '--source',
          'msstore',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
    ],
  },
  opencode: {
    docsUrl: 'https://opencode.ai/',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'SST.opencode',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'opencode', '-y', '--no-progress'],
      },
      {
        manager: 'npm',
        command: 'npm',
        args: ['install', '--global', 'opencode-ai', '--yes', '--silent'],
      },
    ],
  },
  'visual-studio': {
    docsUrl: 'https://visualstudio.microsoft.com/vs/community/',
    attempts: [
      {
        manager: 'winget',
        command: 'winget',
        args: [
          'install',
          '--id',
          'Microsoft.VisualStudio.2022.Community',
          '--exact',
          '--silent',
          '--accept-package-agreements',
          '--accept-source-agreements',
          '--disable-interactivity',
        ],
      },
      {
        manager: 'choco',
        command: 'choco',
        args: ['install', 'visualstudio2022community', '-y', '--no-progress'],
      },
    ],
  },
}

const MANAGER_COMMANDS: Readonly<Record<AutomaticInstallManager, readonly string[]>> = {
  winget: ['winget'],
  choco: ['choco'],
  npm: ['npm'],
}

const requiresElevation = (text: string): boolean =>
  /(run as administrator|administrator privileges|requires elevation|elevation required|access is denied)/i.test(
    text,
  )

const managerAvailable = (manager: AutomaticInstallManager): boolean =>
  hasWindowsCommandOnPath(MANAGER_COMMANDS[manager])

const clampProgress = (progress: number): number => Math.min(100, Math.max(0, Math.round(progress)))

const progressForAttempt = (
  attemptIndex: number,
  attemptCount: number,
  segment: 'check' | 'running' | 'result',
): number => {
  if (attemptCount <= 0) return 95
  const start = 5
  const total = 90
  const span = total / attemptCount
  const offset = segment === 'check' ? 0 : segment === 'running' ? 0.5 : 1
  return start + (attemptIndex - 1 + offset) * span
}

const createProgressEmitter = (
  clientId: ClientId,
  reportProgress?: InstallProgressReporter,
): ((payload: Omit<ClientInstallProgressPayload, 'clientId'>) => void) => {
  let lastProgress = 0

  return (payload) => {
    if (!reportProgress) return

    const nextProgress = clampProgress(payload.progress)
    const monotonicProgress = Math.max(lastProgress, nextProgress)
    lastProgress = monotonicProgress

    try {
      reportProgress({
        ...payload,
        clientId,
        progress: monotonicProgress,
      })
    } catch (err) {
      log.warn(`[clients:install] progress reporter failed for ${clientId}: ${String(err)}`)
    }
  }
}

const execute = async (command: string, args: readonly string[]): Promise<InstallExecutionResult> =>
  new Promise((resolve) => {
    const child = spawn(command, [...args], {
      windowsHide: true,
      stdio: 'pipe',
      shell: false,
    })

    let stdout = ''
    let stderr = ''
    let errored = false

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    child.once('error', (err: Error) => {
      errored = true
      resolve({
        exitCode: 1,
        stdout,
        stderr,
        error: err.message,
      })
    })
    child.once('close', (code: number | null) => {
      if (errored) return
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })
  })

const failureResult = (
  clientId: ClientId,
  attempts: readonly ClientInstallAttempt[],
  failureReason: ClientInstallFailureReason,
  message: string,
  docsUrl?: string,
): ClientInstallResult => ({
  clientId,
  success: false,
  attempts,
  failureReason,
  ...(docsUrl ? { docsUrl } : {}),
  message,
})

export class ClientInstallService {
  async install(
    clientId: ClientId,
    reportProgress?: InstallProgressReporter,
  ): Promise<ClientInstallResult> {
    const expectedAttemptCount = INSTALL_DEFINITIONS[clientId]?.attempts.length ?? 0
    const emitProgress = createProgressEmitter(clientId, reportProgress)
    emitProgress({
      phase: 'start',
      progress: 1,
      attemptIndex: 0,
      attemptCount: expectedAttemptCount,
    })

    if (process.platform !== 'win32') {
      const result = failureResult(
        clientId,
        [],
        'unsupported_platform',
        'In-app installs are currently supported on Windows only.',
      )
      emitProgress({
        phase: 'completed',
        progress: 100,
        attemptIndex: 0,
        attemptCount: expectedAttemptCount,
        ...(result.failureReason ? { failureReason: result.failureReason } : {}),
      })
      return result
    }

    const definition = INSTALL_DEFINITIONS[clientId]
    if (!definition) {
      const result = failureResult(
        clientId,
        [],
        'unsupported_client',
        `No install definition is available for client: ${clientId}`,
      )
      emitProgress({
        phase: 'completed',
        progress: 100,
        attemptIndex: 0,
        attemptCount: 0,
        ...(result.failureReason ? { failureReason: result.failureReason } : {}),
      })
      return result
    }

    if (definition.manualOnly || definition.attempts.length === 0) {
      const result = failureResult(
        clientId,
        [],
        'manual_install_required',
        'Automatic install is not available for this client. Please install it manually.',
        definition.docsUrl,
      )
      emitProgress({
        phase: 'completed',
        progress: 100,
        attemptIndex: 0,
        attemptCount: definition.attempts.length,
        ...(result.failureReason ? { failureReason: result.failureReason } : {}),
      })
      return result
    }

    const attempts: ClientInstallAttempt[] = []
    let hadRunnableManager = false
    let sawElevationFailure = false
    const attemptCount = definition.attempts.length
    let attemptIndex = 0

    for (const installAttempt of definition.attempts) {
      attemptIndex += 1
      emitProgress({
        phase: 'manager_check',
        progress: progressForAttempt(attemptIndex, attemptCount, 'check'),
        attemptIndex,
        attemptCount,
        manager: installAttempt.manager,
      })

      if (!managerAvailable(installAttempt.manager)) {
        attempts.push({
          manager: installAttempt.manager,
          command: installAttempt.command,
          args: installAttempt.args,
          success: false,
          skipped: true,
          error: `${installAttempt.manager} is not available on PATH`,
        })
        emitProgress({
          phase: 'manager_skipped',
          progress: progressForAttempt(attemptIndex, attemptCount, 'result'),
          attemptIndex,
          attemptCount,
          manager: installAttempt.manager,
        })
        continue
      }

      hadRunnableManager = true
      emitProgress({
        phase: 'manager_running',
        progress: progressForAttempt(attemptIndex, attemptCount, 'running'),
        attemptIndex,
        attemptCount,
        manager: installAttempt.manager,
      })
      const runResult = await execute(installAttempt.command, installAttempt.args)
      const combinedOutput = `${runResult.stdout}\n${runResult.stderr}\n${runResult.error ?? ''}`

      if (!sawElevationFailure && requiresElevation(combinedOutput)) {
        sawElevationFailure = true
      }

      const result: ClientInstallAttempt = {
        manager: installAttempt.manager,
        command: installAttempt.command,
        args: installAttempt.args,
        success: runResult.exitCode === 0,
        exitCode: runResult.exitCode,
        ...(runResult.stdout.length > 0 ? { stdout: runResult.stdout } : {}),
        ...(runResult.stderr.length > 0 ? { stderr: runResult.stderr } : {}),
        ...(runResult.error ? { error: runResult.error } : {}),
      }

      attempts.push(result)

      emitProgress({
        phase: result.success ? 'manager_succeeded' : 'manager_failed',
        progress: progressForAttempt(attemptIndex, attemptCount, 'result'),
        attemptIndex,
        attemptCount,
        manager: installAttempt.manager,
      })

      if (result.success) {
        log.info(`[clients:install] ${clientId} installed via ${installAttempt.manager}`)
        const successResult: ClientInstallResult = {
          clientId,
          success: true,
          attempts,
          installedWith: installAttempt.manager,
          docsUrl: definition.docsUrl,
          message: `Installed via ${installAttempt.manager}.`,
        }
        emitProgress({
          phase: 'completed',
          progress: 100,
          attemptIndex,
          attemptCount,
          manager: installAttempt.manager,
        })
        return successResult
      }
    }

    if (!hadRunnableManager) {
      const result = failureResult(
        clientId,
        attempts,
        'no_available_manager',
        'No supported package manager is available (winget/choco/npm).',
        definition.docsUrl,
      )
      emitProgress({
        phase: 'completed',
        progress: 100,
        attemptIndex,
        attemptCount,
        ...(result.failureReason ? { failureReason: result.failureReason } : {}),
      })
      return result
    }

    if (sawElevationFailure) {
      const result = failureResult(
        clientId,
        attempts,
        'requires_elevation',
        'Install failed because elevated privileges are required. aidrelay does not auto-elevate.',
        definition.docsUrl,
      )
      emitProgress({
        phase: 'completed',
        progress: 100,
        attemptIndex,
        attemptCount,
        ...(result.failureReason ? { failureReason: result.failureReason } : {}),
      })
      return result
    }

    const result = failureResult(
      clientId,
      attempts,
      'command_failed',
      'Install failed for all attempted package managers.',
      definition.docsUrl,
    )
    emitProgress({
      phase: 'completed',
      progress: 100,
      attemptIndex,
      attemptCount,
      ...(result.failureReason ? { failureReason: result.failureReason } : {}),
    })
    return result
  }
}
