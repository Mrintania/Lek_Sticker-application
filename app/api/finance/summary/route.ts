import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest, canManage } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user || !canManage(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))

  const db = getDb()

  const totalIncome = (db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM finance_income WHERE year = ? AND month = ?`
  ).get(year, month) as { total: number }).total

  const expenseRows = db.prepare(
    `SELECT expense_type, COALESCE(SUM(amount), 0) as total FROM finance_expenses WHERE year = ? AND month = ? GROUP BY expense_type`
  ).all(year, month) as { expense_type: string; total: number }[]

  const totalFixed = expenseRows.find(r => r.expense_type === 'fixed')?.total ?? 0
  const totalVariable = expenseRows.find(r => r.expense_type === 'variable')?.total ?? 0
  const totalExpense = totalFixed + totalVariable

  const odRows = db.prepare(
    `SELECT COALESCE(SUM(e.balance_used), 0) as total
     FROM finance_od_entries e
     JOIN finance_od_accounts a ON a.id = e.od_account_id
     WHERE e.year = ? AND e.month = ? AND a.is_active = 1`
  ).get(year, month) as { total: number }
  const odTotalBalance = odRows.total

  const expenseByCategory = db.prepare(
    `SELECT category, COALESCE(SUM(amount), 0) as total
     FROM finance_expenses WHERE year = ? AND month = ?
     GROUP BY category ORDER BY total DESC`
  ).all(year, month) as { category: string; total: number }[]

  const incomeByType = db.prepare(
    `SELECT income_type, COALESCE(SUM(amount), 0) as total
     FROM finance_income WHERE year = ? AND month = ?
     GROUP BY income_type`
  ).all(year, month) as { income_type: string; total: number }[]

  return NextResponse.json({
    year, month,
    totalIncome,
    totalExpense,
    totalFixed,
    totalVariable,
    netProfit: totalIncome - totalExpense,
    odTotalBalance,
    expenseByCategory,
    incomeByType,
  })
}
