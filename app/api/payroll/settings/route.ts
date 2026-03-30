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
    monthlyMaxAbsent: Number(s.monthly_max_absent ?? 5),
    tier1Threshold: Number(s.tier1_threshold ?? 1),
    tier1Amount: Number(s.tier1_amount ?? 1000),
    tier2Threshold: Number(s.tier2_threshold ?? 3),
    tier2Amount: Number(s.tier2_amount ?? 800),
    tier3Threshold: Number(s.tier3_threshold ?? 5),
    tier3Amount: Number(s.tier3_amount ?? 500),
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
    tier1_threshold = ?, tier1_amount = ?,
    tier2_threshold = ?, tier2_amount = ?,
    tier3_threshold = ?, tier3_amount = ?,
    updated_at = datetime('now') WHERE id = 1`
  ).run(
    body.diligenceBonusEnabled ? 1 : 0,
    body.sickWithCertExempt ? 1 : 0,
    body.monthlyMaxAbsent ?? 5,
    body.tier1Threshold ?? 1, body.tier1Amount ?? 1000,
    body.tier2Threshold ?? 3, body.tier2Amount ?? 800,
    body.tier3Threshold ?? 5, body.tier3Amount ?? 500,
  )
  logAudit(db, user.username, 'settings.payroll_update', 'payroll_settings', '1', {
    diligenceBonusEnabled: body.diligenceBonusEnabled,
    monthlyMaxAbsent: body.monthlyMaxAbsent,
  }, getIp(req))
  return NextResponse.json({ success: true })
}
