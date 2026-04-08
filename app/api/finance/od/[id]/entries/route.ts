import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')

  const db = getDb()

  let where = 'WHERE od_account_id = ?'
  const args: (string | number)[] = [id]
  if (year) { where += ' AND year = ?'; args.push(parseInt(year)) }

  const rows = db.prepare(
    `SELECT * FROM finance_od_entries ${where} ORDER BY year DESC, month DESC`
  ).all(...args)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    year: number; month: number; balance_used: number
    interest_amount?: number; payment_amount?: number; note?: string; entry_date: string
  }

  if (!body.year || !body.month || body.balance_used == null || !body.entry_date) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 })
  }

  const db = getDb()
  const account = db.prepare('SELECT interest_rate FROM finance_od_accounts WHERE id = ?').get(id) as { interest_rate: number } | undefined
  if (!account) return NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 })

  const interest = body.interest_amount ?? parseFloat((body.balance_used * account.interest_rate / 12 / 100).toFixed(2))

  db.prepare(
    `INSERT INTO finance_od_entries (od_account_id, year, month, balance_used, interest_amount, payment_amount, note, entry_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(od_account_id, year, month) DO UPDATE SET
       balance_used = excluded.balance_used,
       interest_amount = excluded.interest_amount,
       payment_amount = excluded.payment_amount,
       note = excluded.note,
       entry_date = excluded.entry_date,
       updated_at = datetime('now')`
  ).run(id, body.year, body.month, body.balance_used, interest, body.payment_amount ?? 0, body.note?.trim() || null, body.entry_date, user.username)

  return NextResponse.json({ success: true })
}
