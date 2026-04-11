import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = getDb()

  const row = db.prepare(`SELECT date FROM special_work_days WHERE id = ?`).get(id) as { date: string } | undefined
  if (!row) return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 })

  db.prepare(`DELETE FROM special_work_days WHERE id = ?`).run(id)

  logAudit(db, user.username, 'special_work_day.delete', 'system', row.date, { date: row.date }, getIp(req))

  return NextResponse.json({ success: true })
}
