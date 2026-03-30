import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function DELETE(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'เฉพาะ Admin เท่านั้น' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const confirm = searchParams.get('confirm')
  if (confirm !== 'yes') {
    return NextResponse.json({ error: 'ต้องส่ง ?confirm=yes เพื่อยืนยัน' }, { status: 400 })
  }

  const db = getDb()

  // Count before delete (for report)
  const scanCount = (db.prepare('SELECT COUNT(*) as c FROM raw_scans').get() as { c: number }).c
  const importCount = (db.prepare('SELECT COUNT(*) as c FROM scan_imports').get() as { c: number }).c
  const payrollCount = (db.prepare('SELECT COUNT(*) as c FROM payroll_records').get() as { c: number }).c

  // Delete scan-derived data (keep leaves, employees, users, settings, overrides)
  db.exec(`
    DELETE FROM raw_scans;
    DELETE FROM scan_imports;
    DELETE FROM payroll_records;
  `)

  logAudit(db, user.username, 'scan.reset', 'system', null, {
    deletedScans: scanCount, deletedImports: importCount, deletedPayroll: payrollCount,
  }, getIp(req))

  return NextResponse.json({
    success: true,
    deleted: {
      rawScans: scanCount,
      scanImports: importCount,
      payrollRecords: payrollCount,
    },
    message: `ลบข้อมูลสแกน ${scanCount} รายการ, ประวัตินำเข้า ${importCount} รายการ, และเงินเดือน ${payrollCount} รายการเรียบร้อยแล้ว`,
  })
}
