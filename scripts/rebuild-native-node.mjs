import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const MAX_ATTEMPTS = 4
const BASE_DELAY_MS = 800

function stopProjectElectronProcesses() {
  if (process.platform !== 'win32') {
    return
  }

  const script =
    '$root = (Get-Location).Path; Get-Process electron -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { Stop-Process -Id $_.Id -Force; Write-Output "[rebuild-native-node] Stopped electron PID $($_.Id)" }'

  spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', script], {
    stdio: 'inherit',
    windowsHide: true
  })
}

function runNodeRebuild() {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const cmd = isWindows ? 'cmd.exe' : 'pnpm'
    const args = isWindows
      ? ['/d', '/s', '/c', 'pnpm rebuild better-sqlite3 keytar']
      : ['rebuild', 'better-sqlite3', 'keytar']
    const child = spawn(cmd, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false
    })

    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
      process.stderr.write(chunk)
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`pnpm rebuild exited with code ${code ?? 'unknown'}\n${output}`))
    })
  })
}

function isWindowsLockError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  return message.includes('eperm') || message.includes('ebusy') || message.includes('operation not permitted')
}

async function main() {
  stopProjectElectronProcesses()

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await runNodeRebuild()
      return
    } catch (error) {
      if (!isWindowsLockError(error) || attempt === MAX_ATTEMPTS) {
        throw error
      }

      const waitMs = BASE_DELAY_MS * attempt
      console.warn(
        `[rebuild-native-node] Native module appears locked (attempt ${attempt}/${MAX_ATTEMPTS}). Retrying in ${waitMs}ms...`
      )
      await delay(waitMs)
    }
  }
}

main().catch((error) => {
  console.error('[rebuild-native-node] Failed to rebuild native modules for Node runtime.')
  console.error(error)
  process.exit(1)
})
