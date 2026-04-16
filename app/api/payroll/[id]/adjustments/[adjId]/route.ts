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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; adjId: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, adjId } = await params
  const payrollId = Number(id)
  const adjustmentId = Number(adjId)

  const db = getDb()
  const adj = db.prepare(`SELECT * FROM payroll_adjustments WHERE id = ? AND payroll_id = ?`).get(adjustmentId, payrollId)
  if (!adj) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  db.prepare(`DELETE FROM payroll_adjustments WHERE id = ?`).run(adjustmentId)
  recalcTotal(db, payrollId)

  logAudit(db, user.username, 'payroll.adjustment.delete', 'payroll_adjustments', String(adjustmentId), { payrollId }, getIp(req))

  return NextResponse.json({ success: true })
}
