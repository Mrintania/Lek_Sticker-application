import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  const rows = db.prepare(`SELECT * FROM finance_recurring_templates ORDER BY expense_type, category`).all()
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    expense_type: string; category: string; sub_category?: string
    default_amount: number; note?: string
  }

  if (!body.expense_type || !body.category) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare(
    `INSERT INTO finance_recurring_templates (expense_type, category, sub_category, default_amount, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(body.expense_type, body.category, body.sub_category?.trim() || null, body.default_amount ?? 0, body.note?.trim() || null, user.username)

  return NextResponse.json({ success: true, id: result.lastInsertRowid })
}
