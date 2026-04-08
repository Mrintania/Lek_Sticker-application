import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    income_type?: string; quantity?: number; price_per_unit?: number
    amount?: number; category?: string; note?: string; entry_date?: string
  }

  let { amount } = body
  if (body.income_type === 'print_order' && body.quantity && body.price_per_unit) {
    amount = body.quantity * body.price_per_unit
  }

  const db = getDb()
  const existing = db.prepare('SELECT id FROM finance_income WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })

  db.prepare(
    `UPDATE finance_income SET
      income_type = COALESCE(?, income_type),
      quantity = ?,
      price_per_unit = ?,
      amount = COALESCE(?, amount),
      category = ?,
      note = ?,
      entry_date = COALESCE(?, entry_date),
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    body.income_type ?? null, body.quantity ?? null, body.price_per_unit ?? null,
    amount ?? null, body.category?.trim() ?? null, body.note?.trim() ?? null,
    body.entry_date ?? null, id
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = getDb()
  const existing = db.prepare('SELECT id FROM finance_income WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })

  db.prepare('DELETE FROM finance_income WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
