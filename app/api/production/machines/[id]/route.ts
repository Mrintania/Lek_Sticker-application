import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(rawId)
  const body = await req.json()
  const db = getDb()

  const machine = db.prepare('SELECT * FROM print_machines WHERE id = ?').get(id) as { id: number; code: string } | undefined
  if (!machine) return NextResponse.json({ error: 'ไม่พบแท่นพิมพ์' }, { status: 404 })

  if (typeof body.isActive === 'boolean') {
    // Toggle active status only
    db.prepare(`UPDATE print_machines SET is_active = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(body.isActive ? 1 : 0, id)
    logAudit(db, user.username, body.isActive ? 'machine.update' : 'machine.deactivate',
      'machine', String(id), { isActive: body.isActive }, getIp(req))
  } else {
    const { code, name, description } = body
    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'กรุณากรอกรหัสและชื่อแท่นพิมพ์' }, { status: 400 })
    }
    try {
      db.prepare(`UPDATE print_machines SET code = ?, name = ?, description = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(code.trim(), name.trim(), description?.trim() || null, id)
      logAudit(db, user.username, 'machine.update', 'machine', String(id), { code, name }, getIp(req))
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes('UNIQUE')) {
        return NextResponse.json({ error: `รหัสแท่นพิมพ์ "${code}" ซ้ำ` }, { status: 409 })
      }
      throw e
    }
  }
  return NextResponse.json({ success: true })
}
