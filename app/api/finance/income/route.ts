import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { validateYearMonth, validateAmount } from '@/lib/validation'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = (page - 1) * limit

  const db = getDb()

  const total = (db.prepare(
    `SELECT COUNT(*) as count FROM finance_income WHERE year = ? AND month = ?`
  ).get(year, month) as { count: number }).count

  const rows = db.prepare(
    `SELECT * FROM finance_income WHERE year = ? AND month = ? ORDER BY entry_date DESC, id DESC LIMIT ? OFFSET ?`
  ).all(year, month, limit, offset)

  return NextResponse.json({ data: rows, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    year: number; month: number; income_type: string
    quantity?: number; price_per_unit?: number; amount: number
    category?: string; note?: string; entry_date: string
  }

  const { year, month, income_type, quantity, price_per_unit, category, note, entry_date } = body
  let { amount } = body

  if (!year || !month || !income_type || !entry_date) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  const ymErr = validateYearMonth(year, month)
  if (ymErr) return NextResponse.json({ error: ymErr }, { status: 400 })

  if (income_type === 'print_order' && quantity && price_per_unit) {
    amount = quantity * price_per_unit
  }
  const amtErr = validateAmount(amount)
  if (amtErr) return NextResponse.json({ error: amtErr }, { status: 400 })

  const db = getDb()
  const result = db.prepare(
    `INSERT INTO finance_income (year, month, income_type, quantity, price_per_unit, amount, category, note, entry_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(year, month, income_type, quantity ?? null, price_per_unit ?? null, amount, category?.trim() || null, note?.trim() || null, entry_date, user.username)

  return NextResponse.json({ success: true, id: result.lastInsertRowid })
}
