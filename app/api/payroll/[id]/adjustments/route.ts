import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

function recalcTotal(db: ReturnType<typeof getDb>, payrollId: number) {
  const adjs = db.prepare(`SELECT type, amount FROM payroll_adjustments WHERE payroll_id = ?`).all(payrollId) as { type: string; amount: number }[]
  const extraBonus = adjs.filter(a => a.type === 'bonus').reduce((s, a) => s + a.amount, 0)
  const extraDeduction = adjs.filter(a => a.type === 'deduction').reduce((s, a) => s + a.amount, 0)
  const rec = db.prepare(`SELECT base_pay, diligence_bonus, deductions FROM payroll_records WHERE id = ?`).get(payrollId) as { base_pay: number; diligence_bonus: number; deductions: number } | undefined
  if (!rec) return
  const totalPay = rec.base_pay + rec.diligence_bonus + extraBonus - extraDeduction - (rec.deductions || 0)
  db.prepare(`UPDATE payroll_records SET extra_bonus = ?, extra_deduction = ?, total_pay = ? WHERE id = ?`)
    .run(extraBonus, extraDeduction, totalPay, payrollId)
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const payrollId = Number(id)
  const db = getDb()

  // Regular users can only read adjustments for their own payroll records
  if (!canManage(user.role)) {
    const rec = db.prepare(`SELECT employee_id FROM payroll_records WHERE id = ?`).get(payrollId) as { employee_id: string } | undefined
    if (!rec || rec.employee_id !== user.employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Migrate legacy extra_bonus / extra_deduction into the new table (one-time, per record)
  const existing = db.prepare(`SELECT COUNT(*) as cnt FROM payroll_adjustments WHERE payroll_id = ?`).get(payrollId) as { cnt: number }
  if (existing.cnt === 0) {
    const rec = db.prepare(`SELECT extra_bonus, extra_bonus_note, extra_deduction, extra_deduction_note FROM payroll_records WHERE id = ?`).get(payrollId) as {
      extra_bonus: number | null; extra_bonus_note: string | null
      extra_deduction: number | null; extra_deduction_note: string | null
    } | undefined
    if (rec) {
      if ((rec.extra_bonus ?? 0) > 0) {
        db.prepare(`INSERT INTO payroll_adjustments (payroll_id, type, amount, note) VALUES (?, 'bonus', ?, ?)`)
          .run(payrollId, rec.extra_bonus, rec.extra_bonus_note ?? null)
      }
      if ((rec.extra_deduction ?? 0) > 0) {
        db.prepare(`INSERT INTO payroll_adjustments (payroll_id, type, amount, note) VALUES (?, 'deduction', ?, ?)`)
          .run(payrollId, rec.extra_deduction, rec.extra_deduction_note ?? null)
      }
    }
  }

  const rows = db.prepare(`SELECT * FROM payroll_adjustments WHERE payroll_id = ? ORDER BY created_at ASC`).all(payrollId)
  return NextResponse.json(rows)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const payrollId = Number(id)
  const body = await req.json()
  const { type, amount, note } = body

  if (!['bonus', 'deduction'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })

  const db = getDb()
  const rec = db.prepare(`SELECT id FROM payroll_records WHERE id = ?`).get(payrollId)
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const result = db.prepare(`INSERT INTO payroll_adjustments (payroll_id, type, amount, note) VALUES (?, ?, ?, ?)`)
    .run(payrollId, type, Number(amount), note || null) as { lastInsertRowid: number }

  recalcTotal(db, payrollId)

  logAudit(db, user.username, 'payroll.adjustment.add', 'payroll_adjustments', String(result.lastInsertRowid), { type, amount, note }, getIp(req))

  return NextResponse.json({ success: true, id: result.lastInsertRowid })
}
