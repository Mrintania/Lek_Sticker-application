import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(user.role)) return NextResponse.json({ error: 'เฉพาะ Admin/Manager เท่านั้น' }, { status: 403 })

  const { dateFrom, dateTo } = await req.json() as { dateFrom?: string; dateTo?: string }

  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: 'กรุณาระบุวันที่เริ่มต้นและสิ้นสุด' }, { status: 400 })
  }

  // Validate YYYY-MM-DD format
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(dateFrom) || !dateRe.test(dateTo)) {
    return NextResponse.json({ error: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' }, { status: 400 })
  }

  if (dateFrom > dateTo) {
    return NextResponse.json({ error: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' }, { status: 400 })
  }

  const db = getDb()

  // Count records to delete (scan_datetime starts with the date prefix)
  const { count } = db.prepare(`
    SELECT COUNT(*) as count FROM raw_scans
    WHERE substr(scan_datetime, 1, 10) >= ? AND substr(scan_datetime, 1, 10) <= ?
  `).get(dateFrom, dateTo) as { count: number }

  if (count === 0) {
    return NextResponse.json({ error: `ไม่พบข้อมูลสแกนในช่วงวันที่ ${dateFrom} ถึง ${dateTo}` }, { status: 404 })
  }

  // Delete records in date range
  db.prepare(`
    DELETE FROM raw_scans
    WHERE substr(scan_datetime, 1, 10) >= ? AND substr(scan_datetime, 1, 10) <= ?
  `).run(dateFrom, dateTo)

  // Clean up orphaned scan_imports (imports that have no remaining raw_scans)
  db.prepare(`
    DELETE FROM scan_imports
    WHERE id NOT IN (SELECT DISTINCT import_id FROM raw_scans WHERE import_id IS NOT NULL)
  `).run()

  logAudit(db, user.username, 'scan.delete_range', 'system', null, {
    dateFrom, dateTo, deletedCount: count,
  }, getIp(req))

  return NextResponse.json({
    success: true,
    deletedCount: count,
    message: `ลบข้อมูลสแกน ${count} รายการ (${dateFrom} ถึง ${dateTo}) เรียบร้อยแล้ว`,
  })
}
