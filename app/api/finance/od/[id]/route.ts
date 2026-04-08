import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as {
    bank_name?: string; account_number?: string
    credit_limit?: number; interest_rate?: number
  }

  const db = getDb()
  const existing = db.prepare('SELECT id FROM finance_od_accounts WHERE id = ?').get(id)
  if (!existing) return NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 })

  db.prepare(
    `UPDATE finance_od_accounts SET
      bank_name      = COALESCE(?, bank_name),
      account_number = COALESCE(?, account_number),
      credit_limit   = COALESCE(?, credit_limit),
      interest_rate  = COALESCE(?, interest_rate),
      updated_at     = datetime('now')
     WHERE id = ?`
  ).run(body.bank_name ?? null, body.account_number ?? null, body.credit_limit ?? null, body.interest_rate ?? null, id)

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = getDb()
  db.prepare(`UPDATE finance_od_accounts SET is_active = 0, updated_at = datetime('now') WHERE id = ?`).run(id)
  return NextResponse.json({ success: true })
}
