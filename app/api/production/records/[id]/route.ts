import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(rawId)
  const db = getDb()
  const record = db.prepare('SELECT id, machine_id, date FROM production_records WHERE id = ?').get(id) as {
    id: number; machine_id: number; date: string
  } | undefined
  if (!record) return NextResponse.json({ error: 'ไม่พบบันทึก' }, { status: 404 })

  db.prepare('DELETE FROM production_records WHERE id = ?').run(id)
  logAudit(db, user.username, 'production.delete', 'production_record', String(id),
    { machine_id: record.machine_id, date: record.date }, getIp(req))
  return NextResponse.json({ success: true })
}
