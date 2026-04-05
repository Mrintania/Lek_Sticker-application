'use client'
import { useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface DeliverySummary {
  byDate: { date: string; total_quantity: number }[]
  byModel: { model_name: string; total_quantity: number; record_count: number }[]
  byDestination: { destination: string; total_quantity: number }[]
  grandTotal: number
  totalDays: number
  topModel: string | null
  dateFrom: string
  dateTo: string
}

const THAI_MONTHS = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']

function getNow() {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export default function DeliveryDashboardPage() {
  const { user, loading } = useCurrentUser()
  const router = useRouter()
  const now = getNow()

  const [selYear, setSelYear]   = useState(now.year)
  const [selMonth, setSelMonth] = useState(now.month)
  const [summary, setSummary]   = useState<DeliverySummary | null>(null)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!loading && user && !['admin', 'manager'].includes(user.role)) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  const fetchSummary = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch(`/api/delivery/summary?year=${selYear}&month=${selMonth}`)
      if (res.ok) setSummary(await res.json())
    } finally {
      setFetching(false)
    }
  }, [selYear, selMonth])

  useEffect(() => { fetchSummary() }, [fetchSummary])

  function prevMonth() {
    if (selMonth === 1) { setSelYear(y => y - 1); setSelMonth(12) }
    else setSelMonth(m => m - 1)
  }

  function nextMonth() {
    if (selYear === now.year && selMonth === now.month) return
    if (selMonth === 12) { setSelYear(y => y + 1); setSelMonth(1) }
    else setSelMonth(m => m + 1)
  }

  const isCurrentMonth = selYear === now.year && selMonth === now.month

  const dailyChartData = (summary?.byDate ?? []).map(d => ({
    name: d.date.slice(8), // DD
    ชิ้น: d.total_quantity,
  }))

  if (loading) return <div className="page-container text-center text-gray-400">⏳ กำลังโหลด...</div>
  if (!user || !['admin', 'manager'].includes(user.role)) return null

  return (
    <div className="page-container">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard งานส่ง</h2>
          <p className="text-sm text-gray-400 mt-0.5">สรุปยอดส่งสินค้าประจำเดือน</p>
        </div>
        <a
          href="/delivery"
          className="btn-secondary text-sm !px-3 flex items-center gap-1.5 flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v16m8-8H4" />
          </svg>
          บันทึกงาน
        </a>
      </div>

      {/* ── Month Navigator ── */}
      <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
        <button
          onClick={prevMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 text-center">
          <p className="font-bold text-gray-800 text-base">{THAI_MONTHS[selMonth]} {selYear + 543}</p>
          {isCurrentMonth && <p className="text-xs text-emerald-600 font-semibold">เดือนปัจจุบัน</p>}
        </div>

        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── Loading ── */}
      {fetching && (
        <div className="flex justify-center py-12">
          <div className="flex items-center gap-3 text-gray-400">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm">กำลังโหลดข้อมูล...</span>
          </div>
        </div>
      )}

      {!fetching && summary && (
        <>
          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Quantity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">📦</div>
                <p className="text-sm text-gray-500 font-medium">รวมทั้งเดือน</p>
              </div>
              <p className="text-3xl font-bold text-emerald-600">{summary.grandTotal.toLocaleString()}</p>
              <p className="text-xs text-gray-400 mt-1">ชิ้น</p>
            </div>

            {/* Days with shipments */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg flex-shrink-0">📅</div>
                <p className="text-sm text-gray-500 font-medium">วันที่มีการส่ง</p>
              </div>
              <p className="text-3xl font-bold text-blue-600">{summary.totalDays}</p>
              <p className="text-xs text-gray-400 mt-1">วัน</p>
            </div>
          </div>

          {/* ── No Data Empty State ── */}
          {summary.grandTotal === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 px-4">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">🚚</div>
              <p className="font-semibold text-gray-700">ยังไม่มีข้อมูลการส่งในเดือนนี้</p>
              <p className="text-sm text-gray-400 mt-1">กดปุ่ม &quot;บันทึกงาน&quot; เพื่อเพิ่มข้อมูลงานส่ง</p>
              <a href="/delivery" className="inline-flex items-center gap-2 mt-5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                บันทึกงานส่ง
              </a>
            </div>
          ) : (
            <>
              {/* ── Daily Bar Chart ── */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  จำนวนส่งรายวัน
                </h3>
                {dailyChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailyChartData} margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip formatter={(v: unknown) => [Number(v).toLocaleString() + ' ชิ้น', 'ส่ง']} />
                      <Bar dataKey="ชิ้น" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
                )}
              </div>

              {/* ── Daily Records Table ── */}
              {summary.byDate.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                  <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    รายการส่งรายวัน
                  </h3>
                  <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                    <table className="w-full text-sm min-w-[240px]">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2.5">วันที่</th>
                          <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2.5">จำนวน (ชิ้น)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...summary.byDate].reverse().map(d => {
                          const [y, m, day] = d.date.split('-')
                          const thaiMonths = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
                          const thaiDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
                          const dateObj = new Date(d.date + 'T00:00:00')
                          const label = `${thaiDays[dateObj.getDay()]} ${Number(day)} ${thaiMonths[Number(m)]} ${Number(y) + 543}`
                          return (
                            <tr key={d.date} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 text-gray-700">{label}</td>
                              <td className="py-2.5 text-right font-bold text-emerald-700">{d.total_quantity.toLocaleString()}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200">
                          <td className="pt-2.5 text-xs font-semibold text-gray-400">รวมทั้งหมด</td>
                          <td className="pt-2.5 text-right font-bold text-emerald-700">{summary.grandTotal.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
