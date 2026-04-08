import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

  const db = getDb()

  const templates = db.prepare(
    `SELECT * FROM finance_recurring_templates WHERE is_active = 1`
  ).all() as { id: number; expense_type: string; category: string; sub_category: string | null; default_amount: number }[]

  const existing = db.prepare(
    `SELECT recurring_id FROM finance_expenses WHERE year = ? AND month = ? AND from_recurring = 1`
  ).all(year, month) as { recurring_id: number }[]

  const existingIds = new Set(existing.map(r => r.recurring_id))
  const suggestions = templates.filter(t => !existingIds.has(t.id))

  return NextResponse.json(suggestions)
}
