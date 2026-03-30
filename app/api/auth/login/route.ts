import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { signToken, COOKIE_OPTIONS, JWTPayload } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function POST(req: NextRequest) {
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
}
