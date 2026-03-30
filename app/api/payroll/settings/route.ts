import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const s = db.prepare('SELECT * FROM payroll_settings WHERE id = 1').get() as Record<string, unknown>
  return NextResponse.json({
    diligenceBonusEnabled: Boolean(s.diligence_bonus_enabled),
    sickWithCertExempt: Boolean(s.sick_with_cert_exempt),
    monthlyMaxAbsent: Number(s.monthly_max_absent ?? 3.5),
    diligenceBaseAmount: Number(s.diligence_base_amount ?? 1000),
    diligenceStepAmount: Number(s.diligence_step_amount ?? 150),
    diligenceMaxDays: Number(s.diligence_max_days ?? 3),
  })
}

export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const db = getDb()
  db.prepare(`UPDATE payroll_settings SET
    diligence_bonus_enabled = ?, sick_with_cert_exempt = ?,
    monthly_max_absent = ?,
    diligence_base_amount = ?,
    diligence_step_amount = ?,
    diligence_max_days = ?,
    updated_at = datetime('now') WHERE id = 1`
  ).run(
    body.diligenceBonusEnabled ? 1 : 0,
    body.sickWithCertExempt ? 1 : 0,
    body.monthlyMaxAbsent ?? 3.5,
    body.diligenceBaseAmount ?? 1000,
    body.diligenceStepAmount ?? 150,
    body.diligenceMaxDays ?? 3,
  )
  logAudit(db, user.username, 'settings.payroll_update', 'payroll_settings', '1', {
    diligenceBonusEnabled: body.diligenceBonusEnabled,
    monthlyMaxAbsent: body.monthlyMaxAbsent,
    diligenceBaseAmount: body.diligenceBaseAmount,
    diligenceStepAmount: body.diligenceStepAmount,
    diligenceMaxDays: body.diligenceMaxDays,
  }, getIp(req))
  return NextResponse.json({ success: true })
}
