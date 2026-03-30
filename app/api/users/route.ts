import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, isAdmin } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  // includeInactive=true สำหรับหน้าจัดการผู้ใช้ (admin เท่านั้น)
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const db = getDb()
  const sql = includeInactive
    ? 'SELECT id, username, role, employee_id, full_name, is_active, created_at FROM users ORDER BY username'
    : 'SELECT id, username, role, employee_id, full_name, is_active, created_at FROM users WHERE is_active = 1 ORDER BY username'
  const users = db.prepare(sql).all()
  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username, password, role, employeeId, fullName } = await req.json()
  if (!username || !password || !role) return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 })

  const db = getDb()
  const hash = bcrypt.hashSync(password, 10)
  try {
    const result = db.prepare('INSERT INTO users (username, password_hash, role, employee_id, full_name) VALUES (?, ?, ?, ?, ?)'
    ).run(username, hash, role, employeeId || null, fullName || null)
    logAudit(db, user.username, 'user.create', 'user', String(result.lastInsertRowid), { username, role }, getIp(req))
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Username ซ้ำ' }, { status: 409 })
  }
}
