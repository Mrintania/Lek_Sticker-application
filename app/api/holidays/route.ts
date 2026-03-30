import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')

  let query = 'SELECT * FROM holidays WHERE 1=1'
  const params: string[] = []

  if (year) {
    query += ` AND date LIKE ?`
    params.push(`${year}-%`)
  }

  query += ' ORDER BY date ASC'
  const holidays = db.prepare(query).all(...params)
  return NextResponse.json(holidays)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { date, name, type } = await req.json()
  if (!date || !name || !type) {
    return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 })
  }
  if (!['thai_national', 'company'].includes(type)) {
    return NextResponse.json({ error: 'ประเภทไม่ถูกต้อง' }, { status: 400 })
  }

  const db = getDb()
  try {
    const result = db.prepare(
      `INSERT INTO holidays (date, name, type) VALUES (?, ?, ?)`
    ).run(date, name, type)
    logAudit(db, user.username, 'holiday.create', 'holiday', String(result.lastInsertRowid), { date, name, type }, getIp(req))
    return NextResponse.json({ success: true, id: result.lastInsertRowid })
  } catch {
    return NextResponse.json({ error: 'วันที่นี้มีอยู่แล้ว' }, { status: 409 })
  }
}
