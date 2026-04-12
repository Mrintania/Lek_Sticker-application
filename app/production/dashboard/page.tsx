'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'

interface SummaryData {
  byMachine: { machine_id: number; machine_code: string; machine_name: string; total_quantity: number; record_count: number }[]
  byEmployee: { employee_id: string; employee_name: string; total_quantity: number; days_worked: number }[]
  byDate: { date: string; total_quantity: number }[]
  byPair: { emp1_id: string; emp1_name: string; emp2_id: string; emp2_name: string; machine_code: string; machine_name: string; total_quantity: number; days_together: number }[]
  grandTotal: number
  dateFrom: string
  dateTo: string
}

type ViewMode = 'day' | 'week' | 'month'
type EmpSortKey = 'employee_name' | 'total_quantity' | 'days_worked' | 'avg_per_day'
type MachineSortKey = 'machine_code' | 'total_quantity' | 'record_count' | 'avg_per_day'

const THAI_MONTHS_FULL = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const THAI_MONTHS      = THAI_MONTHS_FULL
const THAI_MONTHS_SHORT = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const THAI_DAYS_SHORT  = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr(): string { return toDateStr(new Date()) }
function todayParts() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}
function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

// Monday of the week containing dateStr
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return toDateStr(d)
}
function weekEnd(dateStr: string): string {
  return addDays(weekStart(dateStr), 6)
}

function formatThaiDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  const dow = new Date(dateStr + 'T00:00:00').getDay()
  return `${THAI_DAYS_SHORT[dow]} ${Number(d)} ${THAI_MONTHS_SHORT[Number(m)]} ${Number(y) + 543}`
}
function formatThaiDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${Number(d)} ${THAI_MONTHS_SHORT[Number(m)]}`
}
function buildCalendarDays(ym: string): (string | null)[] {
  const [y, m] = ym.split('-').map(Number)
  const firstDay = new Date(y, m - 1, 1).getDay()
  const daysInMonth = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return cells
}

function formatWeekRange(fromStr: string, toStr: string): string {
  const [fy, fm, fd] = fromStr.split('-')
  const [ty, tm, td] = toStr.split('-')
  const yearTH = Number(ty) + 543
  if (fm === tm) return `${Number(fd)}–${Number(td)} ${THAI_MONTHS_SHORT[Number(tm)]} ${yearTH}`
  if (fy === ty) return `${Number(fd)} ${THAI_MONTHS_SHORT[Number(fm)]} – ${Number(td)} ${THAI_MONTHS_SHORT[Number(tm)]} ${yearTH}`
  return `${Number(fd)} ${THAI_MONTHS_SHORT[Number(fm)]} ${Number(fy) + 543} – ${Number(td)} ${THAI_MONTHS_SHORT[Number(tm)]} ${yearTH}`
}

export default function ProductionDashboardPage() {
  const { user, loading: userLoading } = useCurrentUser()
  const router = useRouter()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const now       = todayParts()
  const today     = todayStr()

  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selYear,  setSelYear]  = useState(now.year)
  const [selMonth, setSelMonth] = useState(now.month)
  const [selDate,  setSelDate]  = useState(today)   // used for day & week views

  const [summary,  setSummary]  = useState<SummaryData | null>(null)
  const [loading,  setLoading]  = useState(false)

  const [empSortKey,      setEmpSortKey]      = useState<EmpSortKey>('total_quantity')
  const [empSortDir,      setEmpSortDir]      = useState<'asc' | 'desc'>('desc')
  const [machineSortKey,  setMachineSortKey]  = useState<MachineSortKey>('total_quantity')
  const [machineSortDir,  setMachineSortDir]  = useState<'asc' | 'desc'>('desc')

  // Calendar picker state (day view)
  const [showCalendar,   setShowCalendar]   = useState(false)
  const [calendarYM,     setCalendarYM]     = useState(() => todayStr().slice(0, 7))
  const [recordedDates,  setRecordedDates]  = useState<Set<string>>(new Set())
  const [holidayDates,   setHolidayDates]   = useState<Map<string, string>>(new Map())
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userLoading && !canManage && user !== undefined) router.replace('/dashboard')
  }, [userLoading, canManage, user, router])

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    try {
      let url: string
      if (viewMode === 'day') {
        url = `/api/production/summary?date_from=${selDate}&date_to=${selDate}`
      } else if (viewMode === 'week') {
        const from = weekStart(selDate)
        const to   = weekEnd(selDate)
        url = `/api/production/summary?date_from=${from}&date_to=${to}`
      } else {
        url = `/api/production/summary?year=${selYear}&month=${selMonth}`
      }
      const res = await fetch(url)
      if (res.ok) setSummary(await res.json())
    } finally {
      setLoading(false)
    }
  }, [viewMode, selDate, selYear, selMonth])

  useEffect(() => { if (canManage) fetchSummary() }, [fetchSummary, canManage])

  // Fetch recorded dates + holidays when calendar opens
  useEffect(() => {
    if (!showCalendar) return
    const [y, m] = calendarYM.split('-')
    fetch(`/api/production/summary?year=${y}&month=${m}`)
      .then(r => r.json())
      .then(data => setRecordedDates(new Set((data.byDate as { date: string }[]).map(d => d.date))))
      .catch(() => {})
    fetch(`/api/holidays?year=${y}`)
      .then(r => r.json())
      .then((data: { date: string; name: string; is_active: number }[]) => {
        const map = new Map<string, string>()
        for (const h of data) { if (h.is_active) map.set(h.date, h.name) }
        setHolidayDates(map)
      })
      .catch(() => {})
  }, [showCalendar, calendarYM])

  useEffect(() => {
    if (!showCalendar) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowCalendar(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [showCalendar])

  if (userLoading || !canManage) return null

  // ── Navigation helpers ────────────────────────────────────────────────────
  function prevMonth() {
    if (selMonth === 1) { setSelYear(y => y - 1); setSelMonth(12) } else setSelMonth(m => m - 1)
    setViewMode('month')
  }
  function nextMonth() {
    if (selYear > now.year || (selYear === now.year && selMonth >= now.month)) return
    if (selMonth === 12) { setSelYear(y => y + 1); setSelMonth(1) } else setSelMonth(m => m + 1)
    setViewMode('month')
  }

  function prevWeek() { setSelDate(d => addDays(weekStart(d), -7)) }
  function nextWeek() {
    const next = addDays(weekStart(selDate), 7)
    if (next > today) return
    setSelDate(next)
  }

  function prevDay() { setSelDate(d => addDays(d, -1)) }
  function nextDay() {
    const next = addDays(selDate, 1)
    if (next > today) return
    setSelDate(next)
  }

  const isNextMonthDisabled = selYear > now.year || (selYear === now.year && selMonth >= now.month)
  const isNextWeekDisabled  = addDays(weekStart(selDate), 7) > today
  const isNextDayDisabled   = addDays(selDate, 1) > today

  const yearOptions = Array.from({ length: 4 }, (_, i) => now.year - 3 + i)

  // ── Stats ─────────────────────────────────────────────────────────────────
  const numDays   = summary?.byDate.length ?? 0
  const avgPerDay = numDays > 0 ? Math.round((summary?.grandTotal ?? 0) / numDays) : 0
  const topMachine = summary?.byMachine[0]
  const bestPair   = summary?.byPair[0]

  // ── Chart data ────────────────────────────────────────────────────────────
  const machineChartData = summary?.byMachine.map(m => ({
    name: m.machine_code, ชิ้น: m.total_quantity, label: m.machine_name,
  })) ?? []

  const empChartData = (summary?.byEmployee ?? []).slice(0, 10).map(e => ({
    name: e.employee_name.split(' ')[0], ชิ้น: e.total_quantity, label: e.employee_name,
  }))

  // For week view: map dates to Thai day-of-week labels; for month: MM-DD
  const dailyChartData = (summary?.byDate ?? []).map(d => {
    const label = viewMode === 'week'
      ? THAI_DAYS_SHORT[new Date(d.date + 'T00:00:00').getDay()] + ' ' + formatThaiDateShort(d.date)
      : d.date.slice(5)   // MM-DD
    return { name: label, ชิ้น: d.total_quantity }
  })

  // ── Sort ──────────────────────────────────────────────────────────────────
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
    if (empSortKey === 'employee_name')  { av = a.employee_name; bv = b.employee_name }
    else if (empSortKey === 'total_quantity') { av = a.total_quantity; bv = b.total_quantity }
    else if (empSortKey === 'days_worked')    { av = a.days_worked;    bv = b.days_worked }
    else if (empSortKey === 'avg_per_day')    { av = a.days_worked > 0 ? a.total_quantity / a.days_worked : 0; bv = b.days_worked > 0 ? b.total_quantity / b.days_worked : 0 }
    if (av < bv) return empSortDir === 'asc' ? -1 : 1
    if (av > bv) return empSortDir === 'asc' ? 1 : -1
    return 0
  })

  const sortedMachines = [...(summary?.byMachine ?? [])].sort((a, b) => {
    let av: number | string = 0, bv: number | string = 0
    if (machineSortKey === 'machine_code')  { av = a.machine_code; bv = b.machine_code }
    else if (machineSortKey === 'total_quantity') { av = a.total_quantity; bv = b.total_quantity }
    else if (machineSortKey === 'record_count')   { av = a.record_count;   bv = b.record_count }
    else if (machineSortKey === 'avg_per_day')     { av = a.record_count > 0 ? a.total_quantity / a.record_count : 0; bv = b.record_count > 0 ? b.total_quantity / b.record_count : 0 }
    if (av < bv) return machineSortDir === 'asc' ? -1 : 1
    if (av > bv) return machineSortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortArrow = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) => (
    <span className={`inline-block ml-0.5 text-xs ${active ? 'text-blue-600' : 'text-gray-300'}`}>
      {!active ? '↕' : dir === 'asc' ? '↑' : '↓'}
    </span>
  )

  // ── Period label shown in stat cards ─────────────────────────────────────
  const periodLabel =
    viewMode === 'day'   ? formatThaiDate(selDate) :
    viewMode === 'week'  ? formatWeekRange(weekStart(selDate), weekEnd(selDate)) :
    `${THAI_MONTHS[selMonth]} ${selYear + 543}`

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard ผลผลิต</h2>
          <p className="text-sm text-gray-400 mt-0.5">{periodLabel}</p>
        </div>
        <a href="/production" className="btn-secondary text-sm !px-3 flex-shrink-0">
          + บันทึกงาน
        </a>
      </div>

      {/* ── View Mode + Filter ── */}
      <div className="card !p-3 sm:!p-4 space-y-3">

        {/* Tab selector */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 self-start w-full sm:w-auto">
          {([
            { key: 'day'   as ViewMode, label: 'รายวัน',     icon: '📅' },
            { key: 'week'  as ViewMode, label: 'รายสัปดาห์', icon: '📆' },
            { key: 'month' as ViewMode, label: 'รายเดือน',   icon: '🗓️' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === tab.key ? 'bg-white shadow text-blue-700 font-semibold' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* ── Day Navigator ── */}
        {viewMode === 'day' && (
          <div className="flex items-center gap-2">
            <button onClick={prevDay}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={() => { setCalendarYM(selDate.slice(0, 7)); setShowCalendar(true) }}
              className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm hover:border-blue-300 transition-colors cursor-pointer"
            >
              <span className="font-semibold text-gray-800 text-sm sm:text-base">{formatThaiDate(selDate)}</span>
              {selDate === today && (
                <span className="text-xs font-semibold text-white bg-blue-500 px-2 py-0.5 rounded-lg">วันนี้</span>
              )}
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <button onClick={nextDay} disabled={isNextDayDisabled}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {selDate !== today && (
              <button onClick={() => setSelDate(today)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors flex-shrink-0">
                วันนี้
              </button>
            )}
          </div>
        )}

        {/* ── Week Navigator ── */}
        {viewMode === 'week' && (
          <div className="flex items-center gap-2">
            <button onClick={prevWeek}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-2.5 shadow-sm text-center">
              <div className="font-semibold text-gray-800 text-sm sm:text-base">
                {formatWeekRange(weekStart(selDate), weekEnd(selDate))}
              </div>
              <div className="flex items-center justify-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400">จ – อา</span>
                {weekStart(selDate) === weekStart(today) && (
                  <span className="text-xs font-semibold text-white bg-blue-500 px-2 py-0.5 rounded-lg">สัปดาห์นี้</span>
                )}
              </div>
            </div>

            <button onClick={nextWeek} disabled={isNextWeekDisabled}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {weekStart(selDate) !== weekStart(today) && (
              <button onClick={() => setSelDate(today)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 rounded-xl hover:bg-blue-50 transition-colors flex-shrink-0">
                สัปดาห์นี้
              </button>
            )}
          </div>
        )}

        {/* ── Month Navigator ── */}
        {viewMode === 'month' && (
          <>
            <div className="flex items-center gap-2">
              <button onClick={prevMonth}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2 flex-1 bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-sm">
                <select value={selMonth} onChange={e => setSelMonth(Number(e.target.value))}
                  className="font-semibold text-gray-800 bg-transparent border-none outline-none cursor-pointer text-sm sm:text-base flex-1">
                  {THAI_MONTHS.slice(1).map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name}</option>
                  ))}
                </select>
                <select value={selYear} onChange={e => setSelYear(Number(e.target.value))}
                  className="font-semibold text-blue-700 bg-transparent border-none outline-none cursor-pointer text-sm sm:text-base">
                  {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                </select>
              </div>

              <button onClick={nextMonth} disabled={isNextMonthDisabled}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Month pills */}
            <div className="flex gap-1.5 flex-wrap">
              {THAI_MONTHS_SHORT.slice(1).map((name, i) => {
                const m = i + 1
                const isActive = selMonth === m
                const isFuture = selYear > now.year || (selYear === now.year && m > now.month)
                return (
                  <button key={m} disabled={isFuture}
                    onClick={() => setSelMonth(m)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-colors font-medium
                      ${isActive ? 'bg-blue-600 text-white border-blue-600' : ''}
                      ${!isActive && !isFuture ? 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 bg-white' : ''}
                      ${isFuture ? 'border-gray-100 text-gray-300 bg-gray-50 cursor-not-allowed' : ''}
                    `}>{name}</button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-3 py-10 text-sm text-gray-400">
          <svg className="w-5 h-5 animate-spin text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          กำลังโหลด...
        </div>
      )}

      {!loading && summary && (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="card text-center !py-3 sm:!py-4">
              <p className="text-2xl sm:text-3xl font-bold text-blue-700">{(summary.grandTotal ?? 0).toLocaleString()}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">รวมทั้งหมด (ชิ้น)</p>
            </div>

            {viewMode !== 'day' ? (
              <div className="card text-center !py-3 sm:!py-4">
                <p className="text-2xl sm:text-3xl font-bold text-green-700">{avgPerDay.toLocaleString()}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">เฉลี่ย/วัน (ชิ้น)</p>
              </div>
            ) : (
              <div className="card text-center !py-3 sm:!py-4">
                <p className="text-2xl sm:text-3xl font-bold text-green-700">{summary.byMachine.length}</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">แท่นที่มีบันทึก</p>
              </div>
            )}

            <div className="card text-center !py-3 sm:!py-4">
              {topMachine ? (
                <>
                  <p className="text-lg sm:text-2xl font-bold text-purple-700">{topMachine.machine_code}</p>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">แท่นสูงสุด ({topMachine.total_quantity.toLocaleString()} ชิ้น)</p>
                </>
              ) : <p className="text-sm text-gray-400 mt-4">ยังไม่มีข้อมูล</p>}
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
              ) : <p className="text-sm text-gray-400 mt-4">ยังไม่มีข้อมูล</p>}
            </div>
          </div>

          {/* ── Charts ── */}
          {machineChartData.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">ผลงานต่อแท่นพิมพ์</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={machineChartData} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                    <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString() + ' ชิ้น', 'ผลผลิต']} />
                    <Bar dataKey="ชิ้น" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={60}>
                      <LabelList dataKey="ชิ้น" position="top" style={{ fontSize: 11, fill: '#6b7280' }} formatter={(v: unknown) => { const n = Number(v); return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {empChartData.length > 0 && (
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">ผลงานต่อพนักงาน{viewMode !== 'day' ? ' (Top 10)' : ''}</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={empChartData} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                      <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString() + ' ชิ้น', 'ผลผลิต']} />
                      <Bar dataKey="ชิ้น" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60}>
                        <LabelList dataKey="ชิ้น" position="top" style={{ fontSize: 11, fill: '#6b7280' }} formatter={(v: unknown) => { const n = Number(v); return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Daily / Weekly trend chart */}
          {dailyChartData.length > 1 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                {viewMode === 'week' ? 'ผลผลิตรายวันในสัปดาห์' : 'แนวโน้มรายวัน'}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dailyChartData} margin={{ top: 20, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString() + ' ชิ้น', 'ผลผลิต']} />
                  <Bar dataKey="ชิ้น" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={viewMode === 'week' ? 48 : 36}>
                    <LabelList dataKey="ชิ้น" position="top" style={{ fontSize: 10, fill: '#6b7280' }} formatter={(v: unknown) => { const n = Number(v); return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }} />
                  </Bar>
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
                        { key: 'machine_code'  as MachineSortKey, label: 'แท่น',       cls: '' },
                        { key: 'total_quantity' as MachineSortKey, label: 'รวม (ชิ้น)', cls: 'text-right' },
                        { key: 'record_count'   as MachineSortKey, label: 'วันบันทึก',  cls: 'text-center' },
                        { key: 'avg_per_day'    as MachineSortKey, label: 'เฉลี่ย/วัน', cls: 'text-right' },
                      ]).map(col => (
                        <th key={col.key} className={`table-header cursor-pointer select-none hover:bg-gray-100 ${col.cls}`} onClick={() => toggleMachineSort(col.key)}>
                          {col.label}<SortArrow active={machineSortKey === col.key} dir={machineSortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMachines.map(m => (
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
                        { key: 'employee_name'  as EmpSortKey, label: 'พนักงาน',    cls: '' },
                        { key: 'total_quantity' as EmpSortKey, label: 'รวม (ชิ้น)', cls: 'text-right' },
                        { key: 'days_worked'    as EmpSortKey, label: 'วันทำงาน',   cls: 'text-center' },
                        { key: 'avg_per_day'    as EmpSortKey, label: 'เฉลี่ย/วัน', cls: 'text-right' },
                      ]).map(col => (
                        <th key={col.key} className={`table-header cursor-pointer select-none hover:bg-gray-100 ${col.cls}`} onClick={() => toggleEmpSort(col.key)}>
                          {col.label}<SortArrow active={empSortKey === col.key} dir={empSortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEmployees.map(e => (
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

          {summary.grandTotal === 0 && (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📦</p>
              <p className="font-medium text-gray-500">ยังไม่มีข้อมูลผลงานในช่วงนี้</p>
              <p className="text-xs mt-1">{periodLabel}</p>
            </div>
          )}
        </>
      )}

      {/* ── Calendar Picker Modal (day view) ── */}
      {showCalendar && (() => {
        const calDays = buildCalendarDays(calendarYM)
        const [calY, calM] = calendarYM.split('-').map(Number)
        return (
          <div className="modal-backdrop" onClick={() => setShowCalendar(false)}>
            <div
              ref={calendarRef}
              className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-sm mx-4"
              onClick={e => e.stopPropagation()}
            >
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    const [y, m] = calendarYM.split('-').map(Number)
                    const d = new Date(y, m - 2, 1)
                    setCalendarYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-bold text-gray-800">{THAI_MONTHS_FULL[calM]} {calY + 543}</span>
                <button
                  onClick={() => {
                    const [y, m] = calendarYM.split('-').map(Number)
                    const d = new Date(y, m, 1)
                    setCalendarYM(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-1">
                {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {calDays.map((dateStr, i) => {
                  if (!dateStr) return <div key={i} />
                  const isSelected = dateStr === selDate
                  const isToday2   = dateStr === today
                  const hasRecord  = recordedDates.has(dateStr)
                  const isFuture   = dateStr > today
                  const holidayName = holidayDates.get(dateStr)
                  const isSunday   = new Date(dateStr + 'T00:00:00').getDay() === 0
                  const isHoliday  = !!holidayName || isSunday
                  return (
                    <button
                      key={dateStr}
                      onClick={() => { setSelDate(dateStr); setShowCalendar(false) }}
                      disabled={isFuture}
                      title={holidayName}
                      className={`relative flex flex-col items-center justify-center h-9 w-full rounded-xl text-sm font-medium transition-colors
                        ${isSelected ? 'bg-blue-500 text-white shadow-md' : ''}
                        ${!isSelected && isHoliday ? 'bg-red-50 text-red-500' : ''}
                        ${!isSelected && !isHoliday && isToday2 ? 'bg-blue-50 text-blue-700 font-bold' : ''}
                        ${!isSelected && !isHoliday && !isToday2 && !isFuture ? 'text-gray-700 hover:bg-gray-100' : ''}
                        ${isFuture ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
                      `}
                    >
                      <span>{Number(dateStr.split('-')[2])}</span>
                      {(hasRecord || isHoliday) && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {hasRecord && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />}
                          {isHoliday && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-400'}`} />}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  <span>มีข้อมูลผลงาน</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  <span>วันหยุด</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
