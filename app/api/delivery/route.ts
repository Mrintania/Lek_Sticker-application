import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  const db = getDb()

  let whereClause = 'WHERE 1=1'
  const params: string[] = []
  if (date) {
    whereClause += ' AND dr.date = ?'
    params.push(date)
  } else if (dateFrom && dateTo) {
    whereClause += ' AND dr.date BETWEEN ? AND ?'
    params.push(dateFrom, dateTo)
  }

  const records = db.prepare(`
    SELECT dr.id, dr.date, dr.notes, dr.created_by, dr.created_at, dr.updated_at
    FROM delivery_records dr
    ${whereClause}
    ORDER BY dr.date DESC
  `).all(...params) as {
    id: number; date: string; notes: string | null;
    created_by: string | null; created_at: string; updated_at: string
  }[]

  if (records.length === 0) return NextResponse.json([])

  const recordIds = records.map((r) => r.id)
  const items = db.prepare(
    `SELECT * FROM delivery_items WHERE record_id IN (${recordIds.map(() => '?').join(',')}) ORDER BY sort_order`
  ).all(...recordIds) as {
    id: number; record_id: number; model_name: string; quantity: number;
    destination: string | null; sort_order: number
  }[]

  const itemsByRecord = new Map<number, typeof items>()
  for (const item of items) {
    if (!itemsByRecord.has(item.record_id)) itemsByRecord.set(item.record_id, [])
    itemsByRecord.get(item.record_id)!.push(item)
  }

  const result = records.map((r) => {
    const recItems = itemsByRecord.get(r.id) ?? []
    return {
      ...r,
      totalQuantity: recItems.reduce((s, i) => s + i.quantity, 0),
      items: recItems,
    }
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    date: string
    notes?: string
    items: { quantity: number }[]
  }

  const { date, notes, items } = body

  if (!date) return NextResponse.json({ error: 'ต้องระบุวันที่' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'ต้องกรอกรายการอย่างน้อย 1 รายการ' }, { status: 400 })
  }
  for (const item of items) {
    if (!item.quantity || item.quantity <= 0) return NextResponse.json({ error: 'จำนวนต้องมากกว่า 0' }, { status: 400 })
  }

  const db = getDb()

  const saveRecord = db.transaction(() => {
    db.prepare(
      `INSERT OR IGNORE INTO delivery_records (date, created_by) VALUES (?, ?)`
    ).run(date, user.username)

    const record = db.prepare('SELECT id FROM delivery_records WHERE date = ?').get(date) as { id: number }

    db.prepare(
      `UPDATE delivery_records SET notes = ?, updated_at = datetime('now'), created_by = ? WHERE id = ?`
    ).run(notes?.trim() || null, user.username, record.id)

    db.prepare('DELETE FROM delivery_items WHERE record_id = ?').run(record.id)

    for (let i = 0; i < items.length; i++) {
      db.prepare(
        `INSERT INTO delivery_items (record_id, model_name, quantity, sort_order) VALUES (?, ?, ?, ?)`
      ).run(record.id, '', items[i].quantity, i)
    }

    return record.id
  })

  const recordId = saveRecord()
  const totalQty = items.reduce((s, i) => s + i.quantity, 0)
  logAudit(db, user.username, 'delivery.record', 'delivery_record', String(recordId),
    { date, itemCount: items.length, totalQty }, getIp(req))

  return NextResponse.json({ success: true, id: recordId })
}
