import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(params.id) as {
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

  values.push(params.id)
  db.prepare(`UPDATE holidays SET ${updates.join(', ')} WHERE id = ?`).run(...values)
  logAudit(db, user.username, 'holiday.update', 'holiday', params.id, body, getIp(req))
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  const holiday = db.prepare('SELECT * FROM holidays WHERE id = ?').get(params.id) as {
    id: number; type: string; name: string
  } | undefined
  if (!holiday) return NextResponse.json({ error: 'ไม่พบวันหยุด' }, { status: 404 })

  if (holiday.type === 'thai_national') {
    return NextResponse.json({ error: 'วันหยุดนักขัตฤกษ์ไทยไม่สามารถลบได้ กรุณาปิดใช้งานแทน' }, { status: 403 })
  }

  db.prepare('DELETE FROM holidays WHERE id = ?').run(params.id)
  logAudit(db, user.username, 'holiday.delete', 'holiday', params.id, { name: holiday.name }, getIp(req))
  return NextResponse.json({ success: true })
}
