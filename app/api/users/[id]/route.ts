import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, isAdmin } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { logAudit, getIp } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const db = getDb()

  const changes: Record<string, unknown> = {}
  if (body.password) {
    const hash = bcrypt.hashSync(body.password, 10)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id)
    changes.password = '(changed)'
  }

  if (body.role || body.employeeId !== undefined || body.fullName !== undefined || body.isActive !== undefined) {
    db.prepare(`UPDATE users SET
      role = COALESCE(?, role),
      employee_id = ?,
      full_name = COALESCE(?, full_name),
      is_active = COALESCE(?, is_active)
      WHERE id = ?`
    ).run(body.role || null, body.employeeId || null, body.fullName || null, body.isActive !== undefined ? (body.isActive ? 1 : 0) : null, id)
    if (body.role) changes.role = body.role
    if (body.isActive !== undefined) changes.isActive = body.isActive
  }

  logAudit(db, user.username, 'user.update', 'user', id, changes, getIp(req))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as { id: number; username: string; role: string } | undefined
  if (!target) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 })

  // ป้องกันลบตัวเอง
  if (target.username === user.username) {
    return NextResponse.json({ error: 'ไม่สามารถลบบัญชีของตัวเองได้' }, { status: 400 })
  }

  // ป้องกันลบ admin คนสุดท้าย
  if (target.role === 'admin') {
    const adminCount = (db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND is_active = 1").get() as { cnt: number }).cnt
    if (adminCount <= 1) {
      return NextResponse.json({ error: 'ไม่สามารถลบ Admin คนสุดท้ายได้' }, { status: 400 })
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  logAudit(db, user.username, 'user.delete', 'user', id, { deletedUsername: target.username, role: target.role }, getIp(req))
  return NextResponse.json({ success: true })
}
