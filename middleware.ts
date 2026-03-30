import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login']
const COOKIE_NAME = 'att_token'

// Lightweight JWT payload decode for Edge Runtime (no Node.js crypto needed)
// Full cryptographic verification still happens in each API route via jsonwebtoken
function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    // Base64url decode the payload
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64)
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const payload = token ? decodeJwtPayload(token) : null

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Admin-only routes: /admin/* and /api/users
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/users')) {
    if (payload.role !== 'admin') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
