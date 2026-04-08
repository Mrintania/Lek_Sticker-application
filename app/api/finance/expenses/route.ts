import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const expense_type = searchParams.get('expense_type')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = (page - 1) * limit

  const db = getDb()

  let where = 'WHERE year = ? AND month = ?'
  const params: (string | number)[] = [year, month]
  if (expense_type && expense_type !== 'all') {
    where += ' AND expense_type = ?'
    params.push(expense_type)
  }

  const total = (db.prepare(`SELECT COUNT(*) as count FROM finance_expenses ${where}`).get(...params) as { count: number }).count
  const rows = db.prepare(`SELECT * FROM finance_expenses ${where} ORDER BY expense_type, entry_date DESC, id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset)

  return NextResponse.json({ data: rows, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    year: number; month: number; expense_type: string; category: string
    sub_category?: string; amount: number; note?: string; entry_date: string
    from_recurring?: number; recurring_id?: number
  }

  if (!body.year || !body.month || !body.expense_type || !body.category || !body.entry_date) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }
  if (!body.amount || body.amount <= 0) {
    return NextResponse.json({ error: 'ยอดเงินต้องมากกว่า 0' }, { status: 400 })
  }

  const db = getDb()
  const result = db.prepare(
    `INSERT INTO finance_expenses (year, month, expense_type, category, sub_category, amount, note, entry_date, from_recurring, recurring_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    body.year, body.month, body.expense_type, body.category,
    body.sub_category?.trim() || null, body.amount,
    body.note?.trim() || null, body.entry_date,
    body.from_recurring ?? 0, body.recurring_id ?? null, user.username
  )

  return NextResponse.json({ success: true, id: result.lastInsertRowid })
}
