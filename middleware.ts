import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'att_token'

// Paths that anyone (even unauthenticated) can access
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

// Page paths that require admin OR manager role (users are blocked)
const MANAGER_PAGES = [
  '/dashboard', '/daily', '/weekly', '/monthly',
  '/employee', '/employees', '/payroll',
  '/production', '/settings',
  '/delivery', '/finance',
]

// Page paths that require admin role only
const ADMIN_PAGES = ['/admin']

// API paths that require admin OR manager role
const MANAGER_API = [
  '/api/employees', '/api/scans', '/api/holidays',
  '/api/production', '/api/settings',
  '/api/payroll/calculate', '/api/payroll/settings',
  '/api/delivery', '/api/finance',
]

// API paths that require admin role only — return 404 to prevent enumeration
const ADMIN_API = ['/api/admin', '/api/users']

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  res.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()')
  res.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'"
  )
  return res
}

// Lightweight JWT payload decode for Edge Runtime (no Node.js crypto needed)
// Full cryptographic verification still happens in each API route via jsonwebtoken
function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch {
    return null
  }
}

function isApi(pathname: string) { return pathname.startsWith('/api/') }

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Static assets — no auth, no security headers needed
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  // Public paths — accessible without auth
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return withSecurityHeaders(NextResponse.next())
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? decodeJwtPayload(token) : null
  const role = payload?.role ?? null

  // ── Unauthenticated ──────────────────────────────────────────────────────
  if (!role) {
    if (isApi(pathname)) {
      return withSecurityHeaders(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }
    return withSecurityHeaders(NextResponse.redirect(new URL('/login', req.url)))
  }

  // ── Admin-only API — return 404 to non-admins (prevents path enumeration) ──
  if (ADMIN_API.some((p) => pathname.startsWith(p))) {
    if (role !== 'admin') {
      return withSecurityHeaders(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
    }
  }

  // ── Admin-only pages — 404 to non-admins ────────────────────────────────
  if (ADMIN_PAGES.some((p) => pathname.startsWith(p))) {
    if (role !== 'admin') {
      return withSecurityHeaders(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
    }
  }

  // ── Manager/Admin API — block user role ─────────────────────────────────
  if (MANAGER_API.some((p) => pathname.startsWith(p))) {
    if (role === 'user') {
      return withSecurityHeaders(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
    }
  }

  // ── Manager/Admin pages — redirect user role to their own dashboard ─────
  if (MANAGER_PAGES.some((p) => pathname.startsWith(p))) {
    if (role === 'user') {
      return withSecurityHeaders(NextResponse.redirect(new URL('/me', req.url)))
    }
  }

  // ── Payroll PATCH ([id]) — manager/admin only ───────────────────────────
  if (/^\/api\/payroll\/\d+$/.test(pathname) && req.method === 'PATCH') {
    if (role === 'user') {
      return withSecurityHeaders(NextResponse.json({ error: 'Not Found' }, { status: 404 }))
    }
  }

  // ── Root redirect ────────────────────────────────────────────────────────
  if (pathname === '/') {
    const dest = role === 'user' ? '/me' : '/dashboard'
    return withSecurityHeaders(NextResponse.redirect(new URL(dest, req.url)))
  }

  return withSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
