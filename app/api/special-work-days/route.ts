import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  const db = getDb()
  let rows

  if (year && month) {
    const mm = String(month).padStart(2, '0')
    const from = `${year}-${mm}-01`
    const to = `${year}-${mm}-31`
    rows = db.prepare(
      `SELECT * FROM special_work_days WHERE date >= ? AND date <= ? ORDER BY date ASC`
    ).all(from, to)
  } else {
    rows = db.prepare(
      `SELECT * FROM special_work_days ORDER BY date DESC LIMIT 100`
    ).all()
  }

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { date, reason } = await req.json() as { date?: string; reason?: string }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 })
  }

  const db = getDb()

  // Check if already a regular work day (warn but allow)
  try {
    db.prepare(
      `INSERT INTO special_work_days (date, reason, created_by) VALUES (?, ?, ?)`
    ).run(date, reason?.trim() || null, user.username)
  } catch {
    return NextResponse.json({ error: `วันที่ ${date} มีอยู่แล้ว` }, { status: 409 })
  }

  logAudit(db, user.username, 'special_work_day.create', 'system', date, { date, reason }, getIp(req))

  return NextResponse.json({ success: true, message: `เพิ่มวันทำงานพิเศษ ${date} แล้ว` })
}
