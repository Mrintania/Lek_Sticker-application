import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const includeDeleted = searchParams.get('includeDeleted') === 'true'
  const isManager = user.role === 'admin' || user.role === 'manager'

  let query = `SELECT l.*, e.name as employee_name FROM leaves l
    LEFT JOIN employees e ON l.employee_id = e.employee_id WHERE 1=1`
  const params: string[] = []

  // กรองพนักงาน Inactive ออก (e.is_active IS NULL = พนักงานไม่มีในตาราง employees ก็ยังแสดง)
  query += ' AND (e.is_active = 1 OR e.is_active IS NULL)'

  // User role: only see own leaves (never see deleted)
  if (user.role === 'user' && user.employeeId) {
    query += ' AND l.employee_id = ? AND l.deleted_at IS NULL'
    params.push(user.employeeId)
  } else if (isManager && includeDeleted) {
    // Admin/manager with flag: see everything (active + deleted)
  } else {
    // Admin/manager without flag: only active leaves
    query += ' AND l.deleted_at IS NULL'
  }

  if (status) {
    query += ' AND l.status = ?'
    params.push(status)
  }

  query += ' ORDER BY l.date DESC'
  const leaves = db.prepare(query).all(...params)
  return NextResponse.json(leaves)
}

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { employeeId, leaveType, date, hasMedicalCert, reason } = body

  // User can only submit own leave
  const targetEmpId = user.role === 'user' ? user.employeeId : employeeId
  if (!targetEmpId) return NextResponse.json({ error: 'ไม่พบรหัสพนักงาน' }, { status: 400 })

  const db = getDb()

  // ── ตรวจสอบวันที่ ──────────────────────────────────────────────────────
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // ห้ามลาย้อนหลัง (user เท่านั้น — admin/manager ยังแก้ย้อนหลังได้)
  if (user.role === 'user' && date < todayStr) {
    return NextResponse.json({ error: 'ไม่สามารถลาย้อนหลังได้ กรุณาเลือกวันที่ตั้งแต่วันนี้เป็นต้นไป' }, { status: 400 })
  }

  if (date === todayStr) {
    // ลาครึ่งวันบ่าย ต้องขอก่อน 13.00 น.
    if (leaveType === 'half_afternoon' && currentMinutes >= 13 * 60) {
      return NextResponse.json({ error: 'ลาครึ่งวันบ่ายต้องขอก่อน 13.00 น. ไม่สามารถทำรายการได้' }, { status: 400 })
    }

    // ห้ามขอลาในวันที่เริ่มงานไปแล้ว (ยกเว้นลาป่วย)
    if (leaveType !== 'sick') {
      const ws = db.prepare('SELECT work_start_time FROM work_settings WHERE id = 1').get() as { work_start_time: string } | undefined
      if (ws?.work_start_time) {
        const [startHour, startMin] = ws.work_start_time.split(':').map(Number)
        const workStartMinutes = startHour * 60 + startMin
        if (currentMinutes > workStartMinutes) {
          return NextResponse.json({
            error: `ไม่สามารถขอลาในวันนี้ได้ เนื่องจากเวลาทำงานเริ่มแล้ว (${ws.work_start_time} น.)`,
          }, { status: 400 })
        }
      }
    }
  }

  // sick type always has medical cert; full_day never does
  const certValue = leaveType === 'sick' ? 1 : 0
  const result = db.prepare(`INSERT INTO leaves (employee_id, leave_type, date, has_medical_cert, reason)
    VALUES (?, ?, ?, ?, ?)`).run(targetEmpId, leaveType, date, certValue, reason || null)

  logAudit(db, user.username, 'leave.create', 'leave', String(result.lastInsertRowid), {
    employeeId: targetEmpId, leaveType, date, reason: reason || null,
  }, getIp(req))

  return NextResponse.json({ success: true, id: result.lastInsertRowid })
}
