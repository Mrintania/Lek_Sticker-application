import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as { year: number; month: number }
  const { year, month } = body

  if (!year || !month) return NextResponse.json({ error: 'กรุณาระบุปีและเดือน' }, { status: 400 })

  const db = getDb()

  const templates = db.prepare(
    `SELECT * FROM finance_recurring_templates WHERE is_active = 1`
  ).all() as { id: number; expense_type: string; category: string; sub_category: string | null; default_amount: number; note: string | null }[]

  const existing = db.prepare(
    `SELECT recurring_id FROM finance_expenses WHERE year = ? AND month = ? AND from_recurring = 1`
  ).all(year, month) as { recurring_id: number }[]

  const existingIds = new Set(existing.map(r => r.recurring_id))
  const toInsert = templates.filter(t => !existingIds.has(t.id))

  if (toInsert.length === 0) return NextResponse.json({ count: 0 })

  const entry_date = `${year}-${String(month).padStart(2, '0')}-01`
  const insert = db.prepare(
    `INSERT INTO finance_expenses (year, month, expense_type, category, sub_category, amount, note, entry_date, from_recurring, recurring_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )

  const applyAll = db.transaction(() => {
    for (const t of toInsert) {
      insert.run(year, month, t.expense_type, t.category, t.sub_category, t.default_amount, t.note, entry_date, t.id, user.username)
    }
  })
  applyAll()

  return NextResponse.json({ count: toInsert.length })
}
