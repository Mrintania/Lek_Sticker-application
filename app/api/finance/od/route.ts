import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()

  const accounts = db.prepare(
    `SELECT a.*,
       e.balance_used  as latest_balance_used,
       e.interest_amount as latest_interest,
       e.year          as latest_year,
       e.month         as latest_month
     FROM finance_od_accounts a
     LEFT JOIN finance_od_entries e
       ON e.od_account_id = a.id
       AND (e.year * 100 + e.month) = (
         SELECT MAX(x.year * 100 + x.month)
         FROM finance_od_entries x
         WHERE x.od_account_id = a.id
       )
     WHERE a.is_active = 1
     ORDER BY a.bank_name`
  ).all()

  return NextResponse.json(accounts)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    bank_name: string; account_number: string
    credit_limit: number; interest_rate: number
  }

  if (!body.bank_name || !body.account_number) {
    return NextResponse.json({ error: 'กรุณาระบุชื่อธนาคารและเลขบัญชี' }, { status: 400 })
  }

  const db = getDb()
  try {
    const result = db.prepare(
      `INSERT INTO finance_od_accounts (bank_name, account_number, credit_limit, interest_rate, created_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(body.bank_name.trim(), body.account_number.trim(), body.credit_limit ?? 0, body.interest_rate ?? 0, user.username)
    return NextResponse.json({ success: true, id: result.lastInsertRowid })
  } catch {
    return NextResponse.json({ error: 'บัญชีนี้มีอยู่แล้ว' }, { status: 409 })
  }
}
