import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: rawId } = await params
  const id = parseInt(rawId)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const db = getDb()
  const record = db.prepare('SELECT id, date FROM delivery_records WHERE id = ?').get(id) as { id: number; date: string } | undefined
  if (!record) return NextResponse.json({ error: 'ไม่พบบันทึก' }, { status: 404 })

  db.prepare('DELETE FROM delivery_records WHERE id = ?').run(id)

  logAudit(db, user.username, 'delivery.delete', 'delivery_record', String(id),
    { date: record.date }, getIp(req))

  return NextResponse.json({ success: true })
}
