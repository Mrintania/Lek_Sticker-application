import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    expense_type?: string; category?: string; sub_category?: string
    default_amount?: number; note?: string; is_active?: number
  }

  const db = getDb()
  const existing = db.prepare('SELECT id FROM finance_recurring_templates WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: 'ไม่พบ template' }, { status: 404 })

  db.prepare(
    `UPDATE finance_recurring_templates SET
      expense_type   = COALESCE(?, expense_type),
      category       = COALESCE(?, category),
      sub_category   = ?,
      default_amount = COALESCE(?, default_amount),
      note           = ?,
      is_active      = COALESCE(?, is_active),
      updated_at     = datetime('now')
     WHERE id = ?`
  ).run(
    body.expense_type ?? null, body.category ?? null, body.sub_category?.trim() ?? null,
    body.default_amount ?? null, body.note?.trim() ?? null, body.is_active ?? null, id
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = getDb()
  db.prepare(`UPDATE finance_recurring_templates SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(id)
  return NextResponse.json({ success: true })
}
