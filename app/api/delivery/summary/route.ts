import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year  = parseInt(searchParams.get('year')  ?? '')
  const month = parseInt(searchParams.get('month') ?? '')
  const dateFrom = searchParams.get('date_from')
  const dateTo   = searchParams.get('date_to')

  let from: string, to: string
  if (dateFrom && dateTo) {
    from = dateFrom
    to   = dateTo
  } else if (!isNaN(year) && !isNaN(month)) {
    const pad = (n: number) => String(n).padStart(2, '0')
    const lastDay = new Date(year, month, 0).getDate()
    from = `${year}-${pad(month)}-01`
    to   = `${year}-${pad(month)}-${lastDay}`
  } else {
    return NextResponse.json({ error: 'ต้องระบุ year+month หรือ date_from+date_to' }, { status: 400 })
  }

  const db = getDb()

  const byDate = db.prepare(`
    SELECT dr.date, COALESCE(SUM(di.quantity), 0) as total_quantity
    FROM delivery_records dr
    JOIN delivery_items di ON di.record_id = dr.id
    WHERE dr.date BETWEEN ? AND ?
    GROUP BY dr.date
    ORDER BY dr.date
  `).all(from, to) as { date: string; total_quantity: number }[]

  const byModel = db.prepare(`
    SELECT di.model_name,
           COALESCE(SUM(di.quantity), 0) as total_quantity,
           COUNT(DISTINCT dr.id) as record_count
    FROM delivery_items di
    JOIN delivery_records dr ON dr.id = di.record_id
    WHERE dr.date BETWEEN ? AND ?
    GROUP BY di.model_name
    ORDER BY total_quantity DESC
  `).all(from, to) as { model_name: string; total_quantity: number; record_count: number }[]

  const byDestination = db.prepare(`
    SELECT COALESCE(di.destination, 'ไม่ระบุ') as destination,
           SUM(di.quantity) as total_quantity
    FROM delivery_items di
    JOIN delivery_records dr ON dr.id = di.record_id
    WHERE dr.date BETWEEN ? AND ?
    GROUP BY destination
    ORDER BY total_quantity DESC
  `).all(from, to) as { destination: string; total_quantity: number }[]

  const grandTotal = byDate.reduce((s, d) => s + d.total_quantity, 0)
  const totalDays  = byDate.length
  const topModel   = byModel.length > 0 ? byModel[0].model_name : null

  return NextResponse.json({
    byDate,
    byModel,
    byDestination,
    grandTotal,
    totalDays,
    topModel,
    dateFrom: from,
    dateTo: to,
  })
}
