'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { formatCurrency, THAI_MONTHS, THAI_MONTHS_SHORT } from '@/lib/formatters'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'

interface Summary {
  year: number; month: number
  totalIncome: number; totalExpense: number
  totalFixed: number; totalVariable: number
  netProfit: number; odTotalBalance: number
  expenseByCategory: { category: string; total: number }[]
  incomeByType: { income_type: string; total: number }[]
}

interface MonthlyTrend { month: number; income: number; expense: number; net: number }

const CATEGORY_LABELS: Record<string, string> = {
  car_installment: 'ค่างวดรถ', rent: 'ค่าเช่า', salary_total: 'เงินเดือน',
  insurance: 'ค่าประกัน', od_interest: 'ดอกเบี้ย OD',
  raw_materials: 'วัตถุดิบ', electricity: 'ค่าไฟ', transport: 'ค่าขนส่ง',
  maintenance: 'ค่าซ่อมบำรุง', ot: 'ค่าโอที', other: 'อื่นๆ',
}

const PIE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

export default function FinanceDashboard() {
  const { user, loading: authLoading } = useCurrentUser()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [trend, setTrend] = useState<MonthlyTrend[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [sumRes, trendRes] = await Promise.all([
      fetch(`/api/finance/summary?year=${year}&month=${month}`),
      fetch(`/api/finance/summary/monthly?year=${year}`)
    ])
    if (sumRes.ok) setSummary(await sumRes.json())
    if (trendRes.ok) setTrend(await trendRes.json())
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  if (authLoading) return <div className="page-container text-center text-gray-400 pt-20">⏳ กำลังโหลด...</div>
  if (!user) return null

  const netIsPositive = (summary?.netProfit ?? 0) >= 0

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-xl font-bold text-gray-900">ภาพรวมการเงิน</h1>
          <p className="text-sm text-gray-500 mt-0.5">{THAI_MONTHS[month - 1]} {year + 543}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="!w-auto" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
            {THAI_MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="!w-auto" value={year} onChange={e => setYear(parseInt(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stat Cards */}
      {loading ? (
        <div className="stats-grid">
          {[1, 2, 3, 4].map(i => <div key={i} className="stat-card"><div className="h-8 bg-gray-100 rounded animate-pulse" /></div>)}
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="text-xs text-gray-500 mb-1">💰 รายรับรวม</div>
            <div className="text-lg sm:text-xl font-bold text-green-600">{formatCurrency(summary?.totalIncome ?? 0)}</div>
          </div>
          <div className="stat-card">
            <div className="text-xs text-gray-500 mb-1">💸 รายจ่ายรวม</div>
            <div className="text-lg sm:text-xl font-bold text-red-600">{formatCurrency(summary?.totalExpense ?? 0)}</div>
          </div>
          <div className="stat-card">
            <div className="text-xs text-gray-500 mb-1">{netIsPositive ? '📈 กำไร' : '📉 ขาดทุน'}</div>
            <div className={`text-lg sm:text-xl font-bold ${netIsPositive ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(summary?.netProfit ?? 0))}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-xs text-gray-500 mb-1">🏦 OD รวม</div>
            <div className="text-lg sm:text-xl font-bold text-orange-600">{formatCurrency(summary?.odTotalBalance ?? 0)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart — 12 months */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm">📊 รายรับ vs รายจ่าย ({year})</h2>
          {loading ? <div className="h-48 bg-gray-50 rounded animate-pulse" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tickFormatter={m => THAI_MONTHS_SHORT[m - 1]} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={m => THAI_MONTHS[Number(m) - 1]} />
                <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => v === 'income' ? 'รายรับ' : 'รายจ่าย'} />
                <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart — expense breakdown */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm">🍩 สัดส่วนรายจ่าย</h2>
          {loading ? <div className="h-48 bg-gray-50 rounded animate-pulse" /> : (summary?.expenseByCategory.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">ยังไม่มีข้อมูลรายจ่าย</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={summary!.expenseByCategory.map(c => ({ name: CATEGORY_LABELS[c.category] || c.category, value: c.total }))}
                  cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {summary!.expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Fixed vs Variable breakdown */}
      {!loading && summary && (
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4 text-sm">รายละเอียดรายจ่าย</h2>
          <div className="form-grid-2 gap-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">💳 คงที่</span>
                <span className="font-semibold text-red-600">{formatCurrency(summary.totalFixed)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-red-500 h-2 rounded-full" style={{ width: summary.totalExpense > 0 ? `${(summary.totalFixed / summary.totalExpense * 100).toFixed(1)}%` : '0%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">📊 ผันแปร</span>
                <span className="font-semibold text-orange-600">{formatCurrency(summary.totalVariable)}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full" style={{ width: summary.totalExpense > 0 ? `${(summary.totalVariable / summary.totalExpense * 100).toFixed(1)}%` : '0%' }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/finance/income', icon: '📥', label: 'รายรับ', color: 'bg-green-50 border-green-200 hover:bg-green-100' },
          { href: '/finance/expenses', icon: '📤', label: 'รายจ่าย', color: 'bg-red-50 border-red-200 hover:bg-red-100' },
          { href: '/finance/od', icon: '🏦', label: 'บัญชี OD', color: 'bg-orange-50 border-orange-200 hover:bg-orange-100' },
          { href: '/finance/recurring', icon: '🔁', label: 'รายจ่ายประจำ', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className={`card border ${item.color} text-center py-4 transition-all hover:shadow-md cursor-pointer`}>
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className="text-sm font-medium text-gray-700">{item.label}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
