import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { signToken, COOKIE_OPTIONS, JWTPayload } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000
interface AttemptRecord { count: number; windowStart: number }
const loginAttempts = new Map<string, AttemptRecord>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const rec = loginAttempts.get(ip)
  if (!rec || now - rec.windowStart > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, windowStart: now })
    return false
  }
  rec.count++
  return rec.count > MAX_ATTEMPTS
}

function resetAttempts(ip: string): void {
  loginAttempts.delete(ip)
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many login attempts. Please try again later.' }, { status: 429 })
    }

    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอก username และ password' }, { status: 400 })
    }

    const db = getDb()
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as {
      id: number; username: string; password_hash: string; role: string; employee_id: string | null; full_name: string | null
    } | undefined

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return NextResponse.json({ error: 'Username หรือ Password ไม่ถูกต้อง' }, { status: 401 })
    }

    resetAttempts(ip)

    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role as JWTPayload['role'],
      employeeId: user.employee_id ?? undefined,
      fullName: user.full_name ?? undefined,
    }

    const token = signToken(payload)
    const res = NextResponse.json({ success: true, user: payload })
    res.cookies.set('att_token', token, COOKIE_OPTIONS)

    logAudit(getDb(), user.username, 'auth.login', 'user', String(user.id), { role: user.role }, getIp(req))

    return res
  } catch (err) {
    console.error('[login] error:', err)
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' }, { status: 500 })
  }
}
