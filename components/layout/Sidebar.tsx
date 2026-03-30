'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  admin: { label: 'Admin', cls: 'bg-red-100 text-red-700' },
  manager: { label: 'Manager', cls: 'bg-blue-100 text-blue-700' },
  user: { label: 'User', cls: 'bg-gray-100 text-gray-600' },
}

interface NavItem {
  href: string
  label: string
  icon: string
  roles?: string[]
}

// รายการรายงานที่จะรวบเป็น dropdown
const reportItems: NavItem[] = [
  { href: '/daily', label: 'รายวัน', icon: '📅' },
  { href: '/weekly', label: 'รายสัปดาห์', icon: '🗓️' },
  { href: '/monthly', label: 'รายเดือน', icon: '📆' },
  { href: '/employee', label: 'รายคน', icon: '👤' },
]

const REPORT_PATHS = reportItems.map((i) => i.href)

const topItems: NavItem[] = [
  { href: '/dashboard', label: 'ภาพรวม', icon: '📊' },
]

const bottomItems: NavItem[] = [
  { href: '/leaves', label: 'ระบบการลา', icon: '🏖️' },
  { href: '/payroll', label: 'เงินเดือน', icon: '💰', roles: ['admin', 'manager'] },
  { href: '/employees', label: 'จัดการพนักงาน', icon: '👥', roles: ['admin', 'manager'] },
  { href: '/admin/users', label: 'จัดการผู้ใช้', icon: '🔑', roles: ['admin'] },
  { href: '/admin/audit', label: 'บันทึกการใช้งาน', icon: '🔍', roles: ['admin'] },
  { href: '/settings', label: 'ตั้งค่า', icon: '⚙️', roles: ['admin'] },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useCurrentUser()
  const [collapsed, setCollapsed] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0)

  const canManage = user?.role === 'admin' || user?.role === 'manager'

  // เปิด reports dropdown อัตโนมัติถ้า path ปัจจุบันอยู่ใน report group
  useEffect(() => {
    if (REPORT_PATHS.includes(pathname)) {
      setReportsOpen(true)
    }
  }, [pathname])

  // ดึงจำนวนใบลารออนุมัติ (เฉพาะ admin/manager)
  useEffect(() => {
    if (!canManage) return
    function fetchPending() {
      fetch('/api/leaves?status=pending')
        .then(r => r.json())
        .then(data => setPendingLeaveCount(Array.isArray(data) ? data.length : 0))
        .catch(() => {})
    }
    fetchPending()
    // refresh ทุก 60 วินาที
    const interval = setInterval(fetchPending, 60_000)
    return () => clearInterval(interval)
  }, [canManage])

  if (pathname === '/login') return null

  const role = user?.role ?? 'user'

  function isVisible(item: NavItem) {
    return !item.roles || item.roles.includes(role)
  }

  const visibleTop = topItems.filter(isVisible)
  const visibleBottom = bottomItems.filter(isVisible)
  const isReportActive = REPORT_PATHS.includes(pathname)

  return (
    <aside
      className={`bg-white border-r border-gray-100 flex flex-col min-h-screen transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className={`flex items-center border-b border-gray-100 h-16 ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
        {!collapsed && (
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-tight">เล็กสติ๊กเกอร์</h1>
            <p className="text-xs text-gray-400">ระบบรายงานการเข้างาน</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
          title={collapsed ? 'ขยาย sidebar' : 'ย่อ sidebar'}
        >
          {collapsed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* User badge */}
      {user && !collapsed && (
        <div className="px-4 py-3 mx-3 mt-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user.fullName || user.username}</p>
              <p className="text-xs text-gray-400 truncate">@{user.username}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_BADGE[role]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
              {ROLE_BADGE[role]?.label ?? role}
            </span>
          </div>
        </div>
      )}
      {user && collapsed && (
        <div className="flex justify-center mt-3">
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${ROLE_BADGE[role]?.cls ?? 'bg-gray-100 text-gray-600'}`}
            title={ROLE_BADGE[role]?.label ?? role}
          >
            {(ROLE_BADGE[role]?.label ?? role).charAt(0)}
          </span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">

        {/* Top items */}
        {visibleTop.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}

        {/* รายงาน dropdown */}
        <div>
          <button
            onClick={() => !collapsed && setReportsOpen(!reportsOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isReportActive
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            } ${collapsed ? 'justify-center' : 'justify-between'}`}
            title={collapsed ? 'รายงาน' : undefined}
          >
            <div className="flex items-center gap-3">
              <span className="text-base flex-shrink-0">📋</span>
              {!collapsed && <span>รายงาน</span>}
            </div>
            {!collapsed && (
              <svg
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${reportsOpen ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          {/* Sub-items เมื่อ expanded */}
          {!collapsed && reportsOpen && (
            <div className="mt-0.5 ml-3 pl-3 border-l-2 border-gray-100 space-y-0.5">
              {reportItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} sub />
              ))}
            </div>
          )}

          {/* Sub-items เมื่อ collapsed — tooltip icons */}
          {collapsed && (
            <div className="mt-0.5 space-y-0.5">
              {reportItems.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} collapsed={true} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom items */}
        {visibleBottom.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
            badge={item.href === '/leaves' && canManage && pendingLeaveCount > 0 ? pendingLeaveCount : undefined}
          />
        ))}
      </nav>

      {/* Logout */}
      {user && (
        <div className={`p-3 border-t border-gray-100 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={logout}
            className={`text-sm text-gray-400 hover:text-red-600 py-2 rounded-lg hover:bg-red-50 transition-colors ${
              collapsed ? 'p-2' : 'w-full px-3'
            }`}
            title="ออกจากระบบ"
          >
            {collapsed ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            ) : (
              '🚪 ออกจากระบบ'
            )}
          </button>
        </div>
      )}
    </aside>
  )
}

function NavLink({
  item,
  pathname,
  collapsed,
  sub = false,
  badge,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  sub?: boolean
  badge?: number
}) {
  const isActive = pathname === item.href
  return (
    <Link
      href={item.href}
      title={collapsed ? (badge ? `${item.label} (${badge} รออนุมัติ)` : item.label) : undefined}
      className={`flex items-center gap-3 rounded-lg text-sm transition-colors ${
        sub ? 'px-2 py-2' : 'px-3 py-2.5'
      } ${collapsed ? 'justify-center' : ''} ${
        isActive
          ? 'bg-blue-50 text-blue-700 font-semibold'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {/* Icon + badge wrapper (collapsed mode) */}
      <span className="relative flex-shrink-0">
        <span className={sub ? 'text-sm' : 'text-base'}>{item.icon}</span>
        {badge && collapsed && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {/* Badge (expanded mode) */}
      {badge && !collapsed && (
        <span className="ml-auto min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}
