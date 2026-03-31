'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface SummaryData {
  byMachine: { machine_id: number; machine_code: string; machine_name: string; total_quantity: number; record_count: number }[]
  byEmployee: { employee_id: string; employee_name: string; total_quantity: number; days_worked: number }[]
  byDate: { date: string; total_quantity: number }[]
  byPair: { emp1_id: string; emp1_name: string; emp2_id: string; emp2_name: string; machine_code: string; machine_name: string; total_quantity: number; days_together: number }[]
  grandTotal: number
  dateFrom: string
  dateTo: string
}

type EmpSortKey = 'employee_name' | 'total_quantity' | 'days_worked' | 'avg_per_day'
type MachineSortKey = 'machine_code' | 'total_quantity' | 'record_count' | 'avg_per_day'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function weekStart() {
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1)
  return d.toISOString().slice(0, 10)
}
function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function monthEnd() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-31`
}

export default function ProductionDashboardPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const router = useRouter()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const [dateFrom, setDateFrom] = useState(monthStart())
  const [dateTo, setDateTo] = useState(monthEnd())
  const [activeRange, setActiveRange] = useState<'today' | 'week' | 'month' | 'custom'>('month')
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const [empSortKey, setEmpSortKey] = useState<EmpSortKey>('total_quantity')
  const [empSortDir, setEmpSortDir] = useState<'asc' | 'desc'>('desc')
  const [machineSortKey, setMachineSortKey] = useState<MachineSortKey>('total_quantity')
  const [machineSortDir, setMachineSortDir] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (!userLoading && !canManage && user !== undefined) router.replace('/dashboard')
  }, [userLoading, canManage, user, router])

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/production/summary?date_from=${dateFrom}&date_to=${dateTo}`)
      if (res.ok) setSummary(await res.json())
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (canManage) fetchSummary()
  }, [fetchSummary, canManage])

  if (userLoading || !canManage) return null

  // Quick range buttons
  function setRange(from: string, to: string, range: 'today' | 'week' | 'month') {
    setDateFrom(from)
    setDateTo(to)
    setActiveRange(range)
  }

  // Stats
  const numDays = summary?.byDate.length ?? 0
  const avgPerDay = numDays > 0 ? Math.round((summary?.grandTotal ?? 0) / numDays) : 0
  const topMachine = summary?.byMachine[0]
  const bestPair = summary?.byPair[0]

  // Chart data
  const machineChartData = summary?.byMachine.map((m) => ({
    name: m.machine_code,
    ชิ้น: m.total_quantity,
    label: m.machine_name,
  })) ?? []

  const empChartData = (summary?.byEmployee ?? []).slice(0, 10).map((e) => ({
    name: e.employee_name.split(' ')[0],
    ชิ้น: e.total_quantity,
    label: e.employee_name,
  }))

  const dailyChartData = summary?.byDate.map((d) => ({
    name: d.date.slice(5),
    ชิ้น: d.total_quantity,
  })) ?? []

  // Sortable employees
  function toggleEmpSort(key: EmpSortKey) {
    if (empSortKey === key) setEmpSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setEmpSortKey(key); setEmpSortDir('desc') }
  }
  function toggleMachineSort(key: MachineSortKey) {
    if (machineSortKey === key) setMachineSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setMachineSortKey(key); setMachineSortDir('desc') }
  }

  const sortedEmployees = [...(summary?.byEmployee ?? [])].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0
    if (empSortKey === 'employee_name') { av = a.employee_name; bv = b.employee_name }
    else if (empSortKey === 'total_quantity') { av = a.total_quantity; bv = b.total_quantity }
    else if (empSortKey === 'days_worked') { av = a.days_worked; bv = b.days_worked }
    else if (empSortKey === 'avg_per_day') { av = a.days_worked > 0 ? a.total_quantity / a.days_worked : 0; bv = b.days_worked > 0 ? b.total_quantity / b.days_worked : 0 }
    if (av < bv) return empSortDir === 'asc' ? -1 : 1
    if (av > bv) return empSortDir === 'asc' ? 1 : -1
    return 0
  })

  const sortedMachines = [...(summary?.byMachine ?? [])].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0
    if (machineSortKey === 'machine_code') { av = a.machine_code; bv = b.machine_code }
    else if (machineSortKey === 'total_quantity') { av = a.total_quantity; bv = b.total_quantity }
    else if (machineSortKey === 'record_count') { av = a.record_count; bv = b.record_count }
    else if (machineSortKey === 'avg_per_day') { av = a.record_count > 0 ? a.total_quantity / a.record_count : 0; bv = b.record_count > 0 ? b.total_quantity / b.record_count : 0 }
    if (av < bv) return machineSortDir === 'asc' ? -1 : 1
    if (av > bv) return machineSortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortArrow = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => (
    <span className={`inline-block ml-0.5 text-xs ${active ? 'text-blue-600' : 'text-gray-300'}`}>
      {!active ? '↕' : dir === 'asc' ? '↑' : '↓'}
    </span>
  )

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard ผลผลิต</h2>
          <p className="text-sm text-gray-400 mt-0.5">สรุปยอดผลิตตามช่วงเวลา</p>
        </div>
      </div>

      {/* Date range filter */}
      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-600">ช่วงเวลา:</span>
          {([
            { key: 'today' as const, label: 'วันนี้', from: todayStr(), to: todayStr() },
            { key: 'week' as const, label: 'สัปดาห์นี้', from: weekStart(), to: todayStr() },
            { key: 'month' as const, label: 'เดือนนี้', from: monthStart(), to: monthEnd() },
          ]).map(({ key, label, from, to }) => (
            <button
              key={key}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${activeRange === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'}`}
              onClick={() => setRange(from, to, key)}
            >{label}</button>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <input type="date" className="!w-auto text-sm" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setActiveRange('custom') }} />
            <span className="text-gray-400 text-sm">ถึง</span>
            <input type="date" className="!w-auto text-sm" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setActiveRange('custom') }} />
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-400 text-sm">⏳ กำลังโหลด...</div>
      )}

      {!loading && summary && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="card text-center !py-3 sm:!py-4">
              <p className="text-2xl sm:text-3xl font-bold text-blue-700">{(summary.grandTotal ?? 0).toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">รวมทั้งหมด (ชิ้น)</p>
            </div>
            <div className="card text-center !py-3 sm:!py-4">
              <p className="text-2xl sm:text-3xl font-bold text-green-700">{avgPerDay.toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">เฉลี่ย/วัน (ชิ้น)</p>
            </div>
            <div className="card text-center !py-3 sm:!py-4">
              {topMachine ? (
                <>
                  <p className="text-lg sm:text-2xl font-bold text-purple-700">{topMachine.machine_code}</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">แท่นสูงสุด ({topMachine.total_quantity.toLocaleString()} ชิ้น)</p>
                </>
              ) : (
                <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>
              )}
            </div>
            <div className="card text-center !py-3 sm:!py-4">
              {bestPair ? (
                <>
                  <p className="text-sm sm:text-base font-bold text-teal-700 leading-tight">
                    {bestPair.emp1_name.split(' ')[0]} + {bestPair.emp2_name.split(' ')[0]}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{bestPair.machine_code}</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">คู่ที่ดีที่สุด ({bestPair.total_quantity.toLocaleString()} ชิ้น)</p>
                </>
              ) : (
                <p className="text-sm text-gray-400">ยังไม่มีข้อมูล</p>
              )}
            </div>
          </div>

          {/* Charts */}
          {machineChartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By machine */}
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">ผลงานต่อแท่นพิมพ์</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={machineChartData} margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString() + ' ชิ้น', 'ผลผลิต']} />
                    <Bar dataKey="ชิ้น" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* By employee */}
              {empChartData.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">ผลงานต่อพนักงาน (Top 10)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={empChartData} margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString() + ' ชิ้น', 'ผลผลิต']} />
                      <Bar dataKey="ชิ้น" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Daily trend */}
          {dailyChartData.length > 1 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">แนวโน้มรายวัน</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyChartData} margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString() + ' ชิ้น', 'ผลผลิต']} />
                  <Bar dataKey="ชิ้น" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Machine table */}
          {sortedMachines.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">รายละเอียดต่อแท่นพิมพ์</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {([
                        { key: 'machine_code' as MachineSortKey, label: 'แท่น', cls: '' },
                        { key: 'total_quantity' as MachineSortKey, label: 'รวม (ชิ้น)', cls: 'text-right' },
                        { key: 'record_count' as MachineSortKey, label: 'วันบันทึก', cls: 'text-center' },
                        { key: 'avg_per_day' as MachineSortKey, label: 'เฉลี่ย/วัน', cls: 'text-right' },
                      ]).map((col) => (
                        <th
                          key={col.key}
                          className={`table-header cursor-pointer select-none hover:bg-gray-100 ${col.cls}`}
                          onClick={() => toggleMachineSort(col.key)}
                        >
                          {col.label}<SortArrow active={machineSortKey === col.key} dir={machineSortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMachines.map((m) => (
                      <tr key={m.machine_id} className="hover:bg-gray-50 border-t border-gray-100">
                        <td className="table-cell">
                          <span className="font-semibold text-purple-700">{m.machine_code}</span>
                          <span className="text-gray-400 ml-2 text-xs">{m.machine_name}</span>
                        </td>
                        <td className="table-cell text-right font-semibold">{m.total_quantity.toLocaleString()}</td>
                        <td className="table-cell text-center text-gray-500">{m.record_count}</td>
                        <td className="table-cell text-right text-gray-600">
                          {m.record_count > 0 ? Math.round(m.total_quantity / m.record_count).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Employee table */}
          {sortedEmployees.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">ผลงานต่อพนักงาน</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {([
                        { key: 'employee_name' as EmpSortKey, label: 'พนักงาน', cls: '' },
                        { key: 'total_quantity' as EmpSortKey, label: 'รวม (ชิ้น)', cls: 'text-right' },
                        { key: 'days_worked' as EmpSortKey, label: 'วันทำงาน', cls: 'text-center' },
                        { key: 'avg_per_day' as EmpSortKey, label: 'เฉลี่ย/วัน', cls: 'text-right' },
                      ]).map((col) => (
                        <th
                          key={col.key}
                          className={`table-header cursor-pointer select-none hover:bg-gray-100 ${col.cls}`}
                          onClick={() => toggleEmpSort(col.key)}
                        >
                          {col.label}<SortArrow active={empSortKey === col.key} dir={empSortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEmployees.map((e) => (
                      <tr key={e.employee_id} className="hover:bg-gray-50 border-t border-gray-100">
                        <td className="table-cell font-medium">{e.employee_name}</td>
                        <td className="table-cell text-right font-semibold text-teal-700">{e.total_quantity.toLocaleString()}</td>
                        <td className="table-cell text-center text-gray-500">{e.days_worked}</td>
                        <td className="table-cell text-right text-gray-600">
                          {e.days_worked > 0 ? Math.round(e.total_quantity / e.days_worked).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pair summary */}
          {summary.byPair.length > 0 && (
            <div className="card !p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">ผลงานต่อคู่พนักงาน</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="table-header">คู่พนักงาน</th>
                      <th className="table-header">แท่น</th>
                      <th className="table-header text-right">รวม (ชิ้น)</th>
                      <th className="table-header text-center">วันทำงานร่วม</th>
                      <th className="table-header text-right">เฉลี่ย/วัน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byPair.map((p, i) => (
                      <tr key={i} className="hover:bg-gray-50 border-t border-gray-100">
                        <td className="table-cell">
                          <span className="font-medium">{p.emp1_name}</span>
                          <span className="text-gray-400 mx-1">+</span>
                          <span className="font-medium">{p.emp2_name}</span>
                        </td>
                        <td className="table-cell">
                          <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">{p.machine_code}</span>
                        </td>
                        <td className="table-cell text-right font-semibold text-teal-700">{p.total_quantity.toLocaleString()}</td>
                        <td className="table-cell text-center text-gray-500">{p.days_together}</td>
                        <td className="table-cell text-right text-gray-600">
                          {p.days_together > 0 ? Math.round(p.total_quantity / p.days_together).toLocaleString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary.grandTotal === 0 && summary.byMachine.every(m => m.total_quantity === 0) && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📦</p>
              <p>ยังไม่มีข้อมูลผลงานในช่วงนี้</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
