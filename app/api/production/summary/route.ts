import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const period = searchParams.get('period') // '1' = days 1–15, '2' = days 16–end
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  let from: string
  let to: string
  if (year && month) {
    const mm = String(month).padStart(2, '0')
    if (period === '2') {
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      from = `${year}-${mm}-16`
      to = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`
    } else if (period === '1') {
      from = `${year}-${mm}-01`
      to = `${year}-${mm}-15`
    } else {
      // ไม่ระบุ period → ทั้งเดือน
      from = `${year}-${mm}-01`
      to = `${year}-${mm}-31`
    }
  } else if (dateFrom && dateTo) {
    from = dateFrom
    to = dateTo
  } else {
    const now = new Date()
    from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`
  }

  const db = getDb()

  const byMachine = db.prepare(`
    SELECT pm.id as machine_id, pm.code as machine_code, pm.name as machine_name,
           COALESCE(SUM(pi.quantity), 0) as total_quantity,
           COUNT(DISTINCT pr.id) as record_count
    FROM print_machines pm
    LEFT JOIN production_records pr ON pr.machine_id = pm.id AND pr.date BETWEEN ? AND ?
    LEFT JOIN production_items pi ON pi.record_id = pr.id
    WHERE pm.is_active = 1
    GROUP BY pm.id
    ORDER BY total_quantity DESC
  `).all(from, to) as { machine_id: number; machine_code: string; machine_name: string; total_quantity: number; record_count: number }[]

  const byEmployee = db.prepare(`
    SELECT ma.employee_id, e.name as employee_name,
           COALESCE(SUM(pi.quantity), 0) as total_quantity,
           COUNT(DISTINCT pr.date) as days_worked
    FROM machine_assignments ma
    JOIN production_records pr ON ma.machine_id = pr.machine_id AND ma.date = pr.date
    JOIN production_items pi ON pi.record_id = pr.id
    JOIN employees e ON e.employee_id = ma.employee_id
    WHERE pr.date BETWEEN ? AND ?
    GROUP BY ma.employee_id
    ORDER BY total_quantity DESC
  `).all(from, to) as { employee_id: string; employee_name: string; total_quantity: number; days_worked: number }[]

  const byDate = db.prepare(`
    SELECT pr.date, COALESCE(SUM(pi.quantity), 0) as total_quantity
    FROM production_records pr
    JOIN production_items pi ON pi.record_id = pr.id
    WHERE pr.date BETWEEN ? AND ?
    GROUP BY pr.date
    ORDER BY pr.date
  `).all(from, to) as { date: string; total_quantity: number }[]

  // Pair summary: employees who worked together on same machine same day
  const pairRows = db.prepare(`
    SELECT a1.employee_id as emp1_id, e1.name as emp1_name,
           a2.employee_id as emp2_id, e2.name as emp2_name,
           pm.code as machine_code, pm.name as machine_name,
           COALESCE(SUM(pi.quantity), 0) as total_quantity,
           COUNT(DISTINCT pr.date) as days_together
    FROM machine_assignments a1
    JOIN machine_assignments a2 ON a1.machine_id = a2.machine_id AND a1.date = a2.date AND a1.slot = 1 AND a2.slot = 2
    JOIN production_records pr ON pr.machine_id = a1.machine_id AND pr.date = a1.date
    JOIN production_items pi ON pi.record_id = pr.id
    JOIN employees e1 ON e1.employee_id = a1.employee_id
    JOIN employees e2 ON e2.employee_id = a2.employee_id
    JOIN print_machines pm ON pm.id = a1.machine_id
    WHERE pr.date BETWEEN ? AND ?
    GROUP BY a1.employee_id, a2.employee_id, a1.machine_id
    ORDER BY total_quantity DESC
  `).all(from, to) as {
    emp1_id: string; emp1_name: string; emp2_id: string; emp2_name: string;
    machine_code: string; machine_name: string; total_quantity: number; days_together: number
  }[]

  const grandTotal = byDate.reduce((s, r) => s + r.total_quantity, 0)

  return NextResponse.json({ byMachine, byEmployee, byDate, byPair: pairRows, grandTotal, dateFrom: from, dateTo: to })
}
