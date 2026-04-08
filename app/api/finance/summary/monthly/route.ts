import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))

  const db = getDb()

  const incomeRows = db.prepare(
    `SELECT month, COALESCE(SUM(amount), 0) as total FROM finance_income WHERE year = ? GROUP BY month`
  ).all(year) as { month: number; total: number }[]

  const expenseRows = db.prepare(
    `SELECT month, COALESCE(SUM(amount), 0) as total FROM finance_expenses WHERE year = ? GROUP BY month`
  ).all(year) as { month: number; total: number }[]

  const incomeMap = new Map(incomeRows.map(r => [r.month, r.total]))
  const expenseMap = new Map(expenseRows.map(r => [r.month, r.total]))

  const result = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const income = incomeMap.get(m) ?? 0
    const expense = expenseMap.get(m) ?? 0
    return { month: m, income, expense, net: income - expense }
  })

  return NextResponse.json(result)
}
