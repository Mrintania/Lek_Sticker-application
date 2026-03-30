import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, isAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDb()
  const { searchParams } = new URL(req.url)

  const action = searchParams.get('action')
  const actor = searchParams.get('actor')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const limit = Math.min(Number(searchParams.get('limit') || 50), 500)
  const offset = Number(searchParams.get('offset') || 0)

  let query = 'SELECT * FROM audit_logs WHERE 1=1'
  const params: unknown[] = []

  if (action) {
    query += ' AND action = ?'
    params.push(action)
  }
  if (actor) {
    query += ' AND actor LIKE ?'
    params.push(`%${actor}%`)
  }
  if (dateFrom) {
    query += ' AND created_at >= ?'
    params.push(dateFrom)
  }
  if (dateTo) {
    query += ' AND created_at <= ?'
    params.push(dateTo + ' 23:59:59')
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as cnt')
  const total = (db.prepare(countQuery).get(...params) as { cnt: number }).cnt

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const logs = db.prepare(query).all(...params)
  return NextResponse.json({ logs, total, limit, offset })
}
