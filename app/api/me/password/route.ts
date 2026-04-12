import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDb } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function PATCH(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 })
  }

  const db = getDb()
  const row = db.prepare(`SELECT password_hash FROM users WHERE id = ?`).get(user.userId) as { password_hash: string } | undefined
  if (!row) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })

  if (!bcrypt.compareSync(currentPassword, row.password_hash)) {
    return NextResponse.json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }, { status: 400 })
  }

  const newHash = bcrypt.hashSync(newPassword, 10)
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(newHash, user.userId)

  logAudit(db, user.username, 'profile.password', 'user', String(user.userId), null, getIp(req))

  return NextResponse.json({ success: true })
}
