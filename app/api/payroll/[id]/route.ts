import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: idStr } = await params
  const id = Number(idStr)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json()
  const { extra_bonus, extra_bonus_note, extra_deduction, extra_deduction_note } = body

  const db = getDb()
  const rec = db.prepare('SELECT * FROM payroll_records WHERE id = ?').get(id) as Record<string, number | string | null> | undefined
  if (!rec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newExtraBonus = extra_bonus != null ? Number(extra_bonus) : Number(rec.extra_bonus ?? 0)
  const newExtraDeduction = extra_deduction != null ? Number(extra_deduction) : Number(rec.extra_deduction ?? 0)
  const newExtraBonusNote = extra_bonus_note !== undefined ? extra_bonus_note : rec.extra_bonus_note
  const newExtraDeductionNote = extra_deduction_note !== undefined ? extra_deduction_note : rec.extra_deduction_note

  const newTotal =
    Number(rec.base_pay) +
    Number(rec.diligence_bonus) +
    newExtraBonus -
    newExtraDeduction -
    Number(rec.deductions ?? 0)

  db.prepare(`
    UPDATE payroll_records
    SET extra_bonus = ?, extra_bonus_note = ?,
        extra_deduction = ?, extra_deduction_note = ?,
        total_pay = ?
    WHERE id = ?
  `).run(newExtraBonus, newExtraBonusNote, newExtraDeduction, newExtraDeductionNote, newTotal, id)

  logAudit(db, user.username, 'payroll.adjustment', 'payroll_records', String(id), {
    extra_bonus: newExtraBonus,
    extra_bonus_note: newExtraBonusNote,
    extra_deduction: newExtraDeduction,
    extra_deduction_note: newExtraDeductionNote,
    total_pay: newTotal,
  }, getIp(req))

  return NextResponse.json({ success: true, total_pay: newTotal })
}
