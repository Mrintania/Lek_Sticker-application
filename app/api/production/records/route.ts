import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  const db = getDb()

  let whereClause = 'WHERE 1=1'
  const params: string[] = []
  if (date) { whereClause += ' AND pr.date = ?'; params.push(date) }
  else if (dateFrom && dateTo) {
    whereClause += ' AND pr.date BETWEEN ? AND ?'
    params.push(dateFrom, dateTo)
  }

  const records = db.prepare(`
    SELECT pr.id, pr.machine_id, pr.date, pr.notes, pr.created_by, pr.created_at,
           pm.code as machine_code, pm.name as machine_name
    FROM production_records pr
    JOIN print_machines pm ON pm.id = pr.machine_id
    ${whereClause}
    ORDER BY pr.date DESC, pm.code
  `).all(...params) as {
    id: number; machine_id: number; date: string; notes: string | null;
    created_by: string; created_at: string; machine_code: string; machine_name: string
  }[]

  if (records.length === 0) return NextResponse.json([])

  const recordIds = records.map((r) => r.id)
  const items = db.prepare(
    `SELECT * FROM production_items WHERE record_id IN (${recordIds.map(() => '?').join(',')}) ORDER BY sort_order`
  ).all(...recordIds) as {
    id: number; record_id: number; model_name: string; quantity: number; sort_order: number
  }[]

  // Assignments for these dates/machines
  const dateSet = [...new Set(records.map((r) => r.date))]
  const machineIds = [...new Set(records.map((r) => r.machine_id))]
  const assignments = db.prepare(`
    SELECT ma.machine_id, ma.date, ma.slot, ma.employee_id, e.name as employee_name
    FROM machine_assignments ma
    JOIN employees e ON e.employee_id = ma.employee_id
    WHERE ma.date IN (${dateSet.map(() => '?').join(',')})
      AND ma.machine_id IN (${machineIds.map(() => '?').join(',')})
  `).all(...dateSet, ...machineIds) as {
    machine_id: number; date: string; slot: number; employee_id: string; employee_name: string
  }[]

  const itemsByRecord = new Map<number, typeof items>()
  for (const item of items) {
    if (!itemsByRecord.has(item.record_id)) itemsByRecord.set(item.record_id, [])
    itemsByRecord.get(item.record_id)!.push(item)
  }

  const result = records.map((r) => {
    const recItems = itemsByRecord.get(r.id) ?? []
    const recAssignments = assignments.filter((a) => a.machine_id === r.machine_id && a.date === r.date)
    return {
      ...r,
      totalQuantity: recItems.reduce((s, i) => s + i.quantity, 0),
      items: recItems,
      employees: recAssignments.sort((a, b) => a.slot - b.slot),
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { machine_id, date, notes, items } = await req.json() as {
    machine_id: number
    date: string
    notes?: string
    items: { model_name: string; quantity: number }[]
  }
  if (!machine_id || !date) return NextResponse.json({ error: 'ต้องระบุ machine_id และ date' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'ต้องกรอกรายการผลงานอย่างน้อย 1 รายการ' }, { status: 400 })
  }
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) return NextResponse.json({ error: 'จำนวนต้องมากกว่า 0' }, { status: 400 })
  }

  const db = getDb()
  const machine = db.prepare('SELECT id FROM print_machines WHERE id = ?').get(machine_id)
  if (!machine) return NextResponse.json({ error: 'ไม่พบแท่นพิมพ์' }, { status: 404 })

  const saveRecord = db.transaction(() => {
    // Upsert header
    db.prepare(
      `INSERT OR IGNORE INTO production_records (machine_id, date, created_by) VALUES (?, ?, ?)`
    ).run(machine_id, date, user.username)
    const record = db.prepare('SELECT id FROM production_records WHERE machine_id = ? AND date = ?').get(machine_id, date) as { id: number }
    db.prepare(
      `UPDATE production_records SET notes = ?, updated_at = datetime('now'), created_by = ? WHERE id = ?`
    ).run(notes?.trim() || null, user.username, record.id)

    // Replace all items
    db.prepare('DELETE FROM production_items WHERE record_id = ?').run(record.id)
    for (let i = 0; i < items.length; i++) {
      db.prepare(
        `INSERT INTO production_items (record_id, model_name, quantity, sort_order) VALUES (?, ?, ?, ?)`
      ).run(record.id, items[i].model_name.trim(), items[i].quantity, i)
    }
    return record.id
  })

  const recordId = saveRecord()
  logAudit(db, user.username, 'production.record', 'production_record', String(recordId),
    { machine_id, date, itemCount: items.length, totalQty: items.reduce((s, i) => s + i.quantity, 0) },
    getIp(req))
  return NextResponse.json({ success: true, id: recordId })
}
