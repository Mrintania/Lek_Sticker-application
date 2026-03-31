import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id) as {
    id: number; type: string
  } | undefined
  if (!holiday) return NextResponse.json({ error: 'ไม่พบวันหยุด' }, { status: 404 })

  const body = await req.json()
  const updates: string[] = []
  const values: unknown[] = []

  if (body.is_active !== undefined) {
    updates.push('is_active = ?')
    values.push(body.is_active ? 1 : 0)
  }
  if (body.name !== undefined) {
    updates.push('name = ?')
    values.push(body.name)
  }

  if (updates.length === 0) return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 400 })

  values.push(id)
  db.prepare(`UPDATE holidays SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  logAudit(db, user.username, 'holiday.update', 'holiday', id, body, getIp(req))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(id) as {
    id: number; type: string; name: string
  } | undefined
  if (!holiday) return NextResponse.json({ error: 'ไม่พบวันหยุด' }, { status: 404 })

  if (holiday.type === 'thai_national') {
    return NextResponse.json({ error: 'วันหยุดนักขัตฤกษ์ไทยไม่สามารถลบได้ กรุณาปิดใช้งานแทน' }, { status: 403 })
  }

  db.prepare('DELETE FROM holidays WHERE id = ?').run(id)
  logAudit(db, user.username, 'holiday.delete', 'holiday', id, { name: holiday.name }, getIp(req))
  return NextResponse.json({ success: true })
}
