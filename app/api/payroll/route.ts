import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  let query = `SELECT pr.*, e.name, e.employment_type FROM payroll_records pr
    LEFT JOIN employees e ON pr.employee_id = e.employee_id WHERE 1=1`
  const params: (string | number)[] = []

  if (user.role === 'user' && user.employeeId) {
    query += ' AND pr.employee_id = ?'
    params.push(user.employeeId)
  }
  if (year) { query += ' AND pr.year = ?'; params.push(Number(year)) }
  if (month) { query += ' AND pr.month = ?'; params.push(Number(month)) }

  query += ' ORDER BY e.name'
  const records = db.prepare(query).all(...params)
  return NextResponse.json(records)
}
