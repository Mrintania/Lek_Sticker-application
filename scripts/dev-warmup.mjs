/**
 * dev-warmup.mjs
 * Pre-compiles all Next.js App Router routes after the dev server starts.
 * Runs in parallel with `next dev` via concurrently.
 * This eliminates the on-demand compilation race condition that causes
 * ENOENT errors on first request to each route.
 */

const PORT = process.env.PORT || 3000
const BASE = `http://localhost:${PORT}`

// All routes that should be pre-compiled at startup
const ROUTES = [
  // Pages
  '/dashboard',
  '/leaves',
  '/payroll',
  '/production',
  '/production/dashboard',
  '/employees',
  '/me',
  '/me/payroll',
  '/settings',
  '/admin/users',
  '/admin/audit',
  '/daily',
  '/monthly',
  '/employee',
  // API routes
  '/api/auth/me',
  '/api/leaves',
  '/api/payroll',
  '/api/payroll/settings',
  '/api/employees',
  '/api/production/machines',
  '/api/production/records',
  '/api/production/summary',
  '/api/holidays',
  // Finance routes
  '/finance',
  '/finance/income',
  '/finance/expenses',
  '/finance/od',
  '/finance/recurring',
  '/api/finance/summary',
]

const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const green  = (s) => `\x1b[32m${s}\x1b[0m`
const gray   = (s) => `\x1b[90m${s}\x1b[0m`
const tag = yellow('[warmup]')

async function fetchWithTimeout(url, ms = 30_000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

async function waitForServer(maxWait = 60) {
  process.stdout.write(`${tag} waiting for Next.js server`)
  for (let i = 0; i < maxWait; i++) {
    try {
      await fetchWithTimeout(`${BASE}/api/auth/me`, 2_000)
      console.log(green(' ✓ ready!'))
      return true
    } catch {
      process.stdout.write('.')
      await new Promise(r => setTimeout(r, 1_000))
    }
  }
  console.log(yellow(' timed out, skipping warmup'))
  return false
}

async function warmUp() {
  const ready = await waitForServer()
  if (!ready) return

  console.log(`${tag} pre-compiling ${ROUTES.length} routes...`)

  // Compile all routes in parallel — Next.js queues the compilations internally
  await Promise.allSettled(
    ROUTES.map(async (route) => {
      try {
        await fetchWithTimeout(`${BASE}${route}`, 30_000)
        console.log(`${tag} ${green('✓')} ${gray(route)}`)
      } catch {
        console.log(`${tag} ${gray('- ' + route)} (skipped)`)
      }
    })
  )

  console.log(`${tag} ${green('✅ warmup complete — all routes pre-compiled')}`)
}

warmUp()
