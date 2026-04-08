/**
 * dev.mjs — Auto-restart wrapper for Next.js + Turbopack
 *
 * ตรวจจับ Turbopack cache corruption errors แล้ว rm -rf .next และ restart อัตโนมัติ
 * รองรับ error patterns:
 *  - Cannot find module '[turbopack]_runtime.js'
 *  - ENOENT: app-paths-manifest.json
 *  - ENOENT: _buildManifest.js.tmp
 */

import { spawn } from 'child_process'
import { rm, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const NEXT_DIR = path.join(ROOT, '.next')

const CRASH_PATTERNS = [
  '[turbopack]_runtime.js',
  'app-paths-manifest.json',
  '_buildManifest.js.tmp',
  'Cannot find module',
]

const cyan   = s => `\x1b[36m${s}\x1b[0m`
const yellow = s => `\x1b[33m${s}\x1b[0m`
const red    = s => `\x1b[31m${s}\x1b[0m`
const green  = s => `\x1b[32m${s}\x1b[0m`
const tag    = cyan('[dev-wrapper]')

let restartCount = 0
let crashBuffer = ''
let crashTimer = null
let currentProc = null

async function cleanCache() {
  console.log(`${tag} ${yellow('🧹 ล้าง .next cache...')}`)
  if (existsSync(NEXT_DIR)) {
    await rm(NEXT_DIR, { recursive: true, force: true })
  }
  await mkdir(path.join(NEXT_DIR, 'static', 'development'), { recursive: true })
  await mkdir(path.join(NEXT_DIR, 'server'), { recursive: true })
  console.log(`${tag} ${green('✓ ล้าง cache เสร็จแล้ว')}`)
}

function startNext() {
  restartCount++
  if (restartCount > 1) {
    console.log(`\n${tag} ${yellow(`🔄 Restart ครั้งที่ ${restartCount - 1} (cache corruption detected)`)}`)
  }

  const proc = spawn(
    'node',
    ['node_modules/.bin/next', 'dev', '--turbopack'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
      stdio: ['inherit', 'pipe', 'pipe'],
    }
  )

  currentProc = proc

  const handleOutput = (data, isStderr) => {
    const text = data.toString()
    process[isStderr ? 'stderr' : 'stdout'].write(text)

    // สะสม output เพื่อตรวจ pattern
    crashBuffer += text
    clearTimeout(crashTimer)
    crashTimer = setTimeout(() => { crashBuffer = '' }, 3000)

    const isCrash = CRASH_PATTERNS.some(p => crashBuffer.includes(p))
    if (isCrash) {
      crashBuffer = ''
      clearTimeout(crashTimer)
      console.log(`\n${tag} ${red('⚠ ตรวจพบ cache corruption — กำลัง restart...')}`)
      proc.kill('SIGTERM')
    }
  }

  proc.stdout.on('data', d => handleOutput(d, false))
  proc.stderr.on('data', d => handleOutput(d, true))

  proc.on('exit', async (code, signal) => {
    currentProc = null
    if (signal === 'SIGINT' || code === 0) {
      // ผู้ใช้กด Ctrl+C หรือปิดปกติ
      process.exit(0)
    }
    // crash → clean + restart
    await cleanCache()
    setTimeout(startNext, 500)
  })
}

// Ctrl+C → ปิด child process ก่อน
process.on('SIGINT', () => {
  if (currentProc) currentProc.kill('SIGINT')
  process.exit(0)
})

// เริ่มต้น
;(async () => {
  await cleanCache()
  startNext()
})()
