import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const includeInactive = searchParams.get('includeInactive') === 'true' && canManage(user.role)

  const db = getDb()
  const sql = includeInactive
    ? 'SELECT * FROM print_machines ORDER BY code'
    : 'SELECT * FROM print_machines WHERE is_active = 1 ORDER BY code'
  const rows = db.prepare(sql).all() as {
    id: number; code: string; name: string; description: string | null; is_active: number; created_at: string
  }[]
  return NextResponse.json(rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
  })))
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { code, name, description } = await req.json()
  if (!code?.trim() || !name?.trim()) {
    return NextResponse.json({ error: 'กรุณากรอกรหัสและชื่อแท่นพิมพ์' }, { status: 400 })
  }

  const db = getDb()
  try {
    const result = db.prepare(
      `INSERT INTO print_machines (code, name, description, created_by) VALUES (?, ?, ?, ?)`
    ).run(code.trim(), name.trim(), description?.trim() || null, user.username)
    logAudit(db, user.username, 'machine.create', 'machine', String(result.lastInsertRowid),
      { code, name }, getIp(req))
    return NextResponse.json({ success: true, id: result.lastInsertRowid })
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('UNIQUE')) {
      return NextResponse.json({ error: `รหัสแท่นพิมพ์ "${code}" ซ้ำ` }, { status: 409 })
    }
    throw e
  }
}
