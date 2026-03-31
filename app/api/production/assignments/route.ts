import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'ต้องระบุ date' }, { status: 400 })

  const db = getDb()
  const rows = db.prepare(`
    SELECT ma.machine_id, ma.date, ma.slot, ma.employee_id,
           e.name as employee_name,
           pm.code as machine_code, pm.name as machine_name
    FROM machine_assignments ma
    JOIN employees e ON e.employee_id = ma.employee_id
    JOIN print_machines pm ON pm.id = ma.machine_id
    WHERE ma.date = ?
    ORDER BY pm.code, ma.slot
  `).all(date) as {
    machine_id: number; date: string; slot: number; employee_id: string;
    employee_name: string; machine_code: string; machine_name: string
  }[]

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { machine_id, date, assignments } = await req.json() as {
    machine_id: number
    date: string
    assignments: { slot: number; employee_id: string }[]
  }
  if (!machine_id || !date) return NextResponse.json({ error: 'ต้องระบุ machine_id และ date' }, { status: 400 })

  const db = getDb()

  // Validate machine exists and is active
  const machine = db.prepare('SELECT id FROM print_machines WHERE id = ? AND is_active = 1').get(machine_id)
  if (!machine) return NextResponse.json({ error: 'ไม่พบแท่นพิมพ์' }, { status: 404 })

  // Validate all employee_ids
  for (const a of assignments) {
    if (!a.employee_id) continue
    const emp = db.prepare('SELECT employee_id FROM employees WHERE employee_id = ? AND is_active = 1').get(a.employee_id)
    if (!emp) return NextResponse.json({ error: `ไม่พบพนักงาน ${a.employee_id}` }, { status: 404 })
    if (![1, 2].includes(a.slot)) return NextResponse.json({ error: 'slot ต้องเป็น 1 หรือ 2' }, { status: 400 })
  }

  const saveAssignments = db.transaction(() => {
    db.prepare('DELETE FROM machine_assignments WHERE machine_id = ? AND date = ?').run(machine_id, date)
    for (const a of assignments) {
      if (!a.employee_id) continue
      db.prepare(
        `INSERT INTO machine_assignments (machine_id, date, employee_id, slot, created_by) VALUES (?, ?, ?, ?, ?)`
      ).run(machine_id, date, a.employee_id, a.slot, user.username)
    }
  })
  saveAssignments()

  logAudit(db, user.username, 'machine.assign', 'machine', String(machine_id),
    { date, assignments }, getIp(req))
  return NextResponse.json({ success: true })
}
