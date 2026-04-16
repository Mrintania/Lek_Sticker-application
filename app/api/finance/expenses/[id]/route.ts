import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    expense_type?: string; category?: string; sub_category?: string
    amount?: number; note?: string; entry_date?: string
    year?: number; month?: number
  }

  // derive year/month from entry_date if provided
  const entryYear  = body.entry_date ? parseInt(body.entry_date.split('-')[0]) : body.year ?? null
  const entryMonth = body.entry_date ? parseInt(body.entry_date.split('-')[1]) : body.month ?? null

  const db = getDb()
  const existing = db.prepare('SELECT id FROM finance_expenses WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })

  db.prepare(
    `UPDATE finance_expenses SET
      year         = COALESCE(?, year),
      month        = COALESCE(?, month),
      expense_type = COALESCE(?, expense_type),
      category     = COALESCE(?, category),
      sub_category = ?,
      amount       = COALESCE(?, amount),
      note         = ?,
      entry_date   = COALESCE(?, entry_date),
      updated_at   = datetime('now')
     WHERE id = ?`
  ).run(
    entryYear, entryMonth,
    body.expense_type ?? null, body.category ?? null, body.sub_category?.trim() ?? null,
    body.amount ?? null, body.note?.trim() ?? null, body.entry_date ?? null, id
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = getDb()
  const existing = db.prepare('SELECT id FROM finance_expenses WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })

  db.prepare('DELETE FROM finance_expenses WHERE id = ?').run(id)
  return NextResponse.json({ success: true })
}
