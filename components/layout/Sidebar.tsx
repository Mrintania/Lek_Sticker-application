'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import ProfileModal from '@/components/ProfileModal'

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

const reportItems: NavItem[] = [
  { href: '/daily', label: 'รายวัน', icon: '📅' },
  { href: '/weekly', label: 'รายสัปดาห์', icon: '🗓️' },
  { href: '/monthly', label: 'รายเดือน', icon: '📆' },
  { href: '/employee', label: 'รายคน', icon: '👤' },
]

const REPORT_PATHS = reportItems.map((i) => i.href)

const financeItems: NavItem[] = [
  { href: '/finance', label: 'ภาพรวมการเงิน', icon: '💹' },
  { href: '/finance/income', label: 'รายรับ', icon: '📥' },
  { href: '/finance/expenses', label: 'รายจ่าย', icon: '📤' },
  { href: '/finance/od', label: 'บัญชี OD', icon: '🏦' },
  { href: '/finance/recurring', label: 'รายจ่ายประจำ', icon: '🔁' },
]
const FINANCE_PATHS = financeItems.map((i) => i.href)

const topItems: NavItem[] = [
  { href: '/me', label: 'หน้าของฉัน', icon: '🏠', roles: ['user'] },
  { href: '/dashboard', label: 'ภาพรวม', icon: '📊', roles: ['admin', 'manager'] },
]

const bottomItems: NavItem[] = [
  { href: '/leaves', label: 'ระบบการลา', icon: '🏖️' },
  { href: '/me/payroll', label: 'ประวัติเงินเดือน', icon: '💰', roles: ['user'] },
  { href: '/payroll', label: 'เงินเดือน', icon: '💰', roles: ['admin', 'manager'] },
  { href: '/production', label: 'บันทึกงานผลิต', icon: '🖨️', roles: ['admin', 'manager'] },
  { href: '/production/dashboard', label: 'Dashboard ผลผลิต', icon: '📦', roles: ['admin', 'manager'] },
  { href: '/delivery', label: 'บันทึกงานส่ง', icon: '🚚', roles: ['admin', 'manager'] },
  { href: '/delivery/dashboard', label: 'Dashboard งานส่ง', icon: '📬', roles: ['admin', 'manager'] },
  { href: '/employees', label: 'จัดการพนักงาน', icon: '👥', roles: ['admin', 'manager'] },
  { href: '/admin/users', label: 'จัดการผู้ใช้', icon: '🔑', roles: ['admin'] },
  { href: '/admin/audit', label: 'บันทึกการใช้งาน', icon: '🔍', roles: ['admin'] },
]

const settingsItem: NavItem = { href: '/settings', label: 'ตั้งค่า', icon: '⚙️', roles: ['admin', 'manager'] }

export default function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useCurrentUser()
  const [collapsed, setCollapsed] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [financeOpen, setFinanceOpen] = useState(false)
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)

  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (pathname && REPORT_PATHS.includes(pathname)) {
      setReportsOpen(true)
    }
    if (pathname && FINANCE_PATHS.some(p => pathname.startsWith(p))) {
      setFinanceOpen(true)
    }
  }, [pathname])

  useEffect(() => {
    if (!canManage) return
    function fetchPending() {
      fetch('/api/leaves?status=pending')
        .then(r => r.json())
        .then(data => setPendingLeaveCount(Array.isArray(data) ? data.length : 0))
        .catch(() => {})
    }
    fetchPending()
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
  const isReportActive = pathname != null && REPORT_PATHS.includes(pathname)

  return (
    <>
      {/* ── Mobile Top Bar ─────────────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-gray-100 flex items-center px-4 shadow-sm">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="เปิดเมนู"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="ml-3">
          <span className="text-base font-bold text-gray-900">เล็กสติ๊กเกอร์</span>
        </div>
        {pendingLeaveCount > 0 && canManage && (
          <Link href="/leaves" className="ml-auto flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-full">
            <span>🏖️</span>
            <span>{pendingLeaveCount} รออนุมัติ</span>
          </Link>
        )}
      </div>

      {/* ── Mobile Backdrop ────────────────────────────────── */}
      <div
        className={`lg:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Sidebar Panel ──────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-gray-100 shadow-xl
          transition-transform duration-300 ease-in-out
          lg:relative lg:shadow-none lg:translate-x-0 lg:z-auto
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          w-72
          lg:transition-all lg:duration-300
          ${collapsed ? 'lg:w-16' : 'lg:w-64'}
        `}
      >
        {/* Header */}
        <div className={`flex items-center border-b border-gray-100 h-16 flex-shrink-0 ${collapsed ? 'lg:justify-center lg:px-2 px-5 justify-between' : 'justify-between px-5'}`}>
          <div className={`${collapsed ? 'lg:hidden' : ''}`}>
            <h1 className="text-base font-bold text-gray-900 leading-tight">เล็กสติ๊กเกอร์</h1>
            <p className="text-xs text-gray-400">ระบบรายงานการเข้างาน</p>
          </div>
          <div className="flex items-center gap-1">
            {/* Mobile close button */}
            <button
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="ปิดเมนู"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Desktop collapse button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
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
        </div>

        {/* User badge */}
        {user && !collapsed && (
          <div className="px-4 py-3 mx-3 mt-3 bg-gray-50 rounded-lg border border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowProfileModal(true)} className="min-w-0 flex-1 text-left group cursor-pointer" title="แก้ไขโปรไฟล์">
                <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">{user.fullName || user.username}</p>
                <p className="text-xs text-gray-400 truncate group-hover:text-blue-400 transition-colors">@{user.username}</p>
              </button>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ROLE_BADGE[role]?.cls ?? 'bg-gray-100 text-gray-600'}`}>
                {ROLE_BADGE[role]?.label ?? role}
              </span>
              {/* Logout icon button */}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="ออกจากระบบ"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {user && collapsed && (
          <div className="hidden lg:flex flex-col items-center gap-2 mt-3 flex-shrink-0">
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${ROLE_BADGE[role]?.cls ?? 'bg-gray-100 text-gray-600'}`}
              title={ROLE_BADGE[role]?.label ?? role}
            >
              {(ROLE_BADGE[role]?.label ?? role).charAt(0)}
            </span>
            {/* Logout icon — collapsed */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="ออกจากระบบ"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}

        {/* Nav — scrollable */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">

          {visibleTop.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}

          {/* รายงาน dropdown — admin/manager only */}
          {(role === 'admin' || role === 'manager') && <div>
            <button
              onClick={() => setReportsOpen(!reportsOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isReportActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${collapsed ? 'lg:justify-center' : 'justify-between'}`}
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

            {/* Desktop expanded + Mobile: show sub-items when open */}
            {!collapsed && reportsOpen && (
              <div className="mt-0.5 ml-3 pl-3 border-l-2 border-gray-100 space-y-0.5">
                {reportItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} sub />
                ))}
              </div>
            )}

            {/* Desktop collapsed only: show icon-only sub-items */}
            {collapsed && (
              <div className="mt-0.5 space-y-0.5 hidden lg:block">
                {reportItems.map((item) => (
                  <NavLink key={item.href} item={item} pathname={pathname} collapsed={true} />
                ))}
              </div>
            )}
          </div>}

          {visibleBottom.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={collapsed}
              badge={item.href === '/leaves' && canManage && pendingLeaveCount > 0 ? pendingLeaveCount : undefined}
            />
          ))}

          {/* การเงิน dropdown — admin/manager only */}
          {(role === 'admin' || role === 'manager') && (
            <div>
              <button
                onClick={() => setFinanceOpen(!financeOpen)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  pathname != null && FINANCE_PATHS.some(p => pathname.startsWith(p))
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } ${collapsed ? 'lg:justify-center' : 'justify-between'}`}
                title={collapsed ? 'การเงิน' : undefined}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base flex-shrink-0">💰</span>
                  {!collapsed && <span>การเงิน</span>}
                </div>
                {!collapsed && (
                  <svg
                    className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${financeOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {!collapsed && financeOpen && (
                <div className="mt-0.5 ml-3 pl-3 border-l-2 border-gray-100 space-y-0.5">
                  {financeItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} collapsed={false} sub />
                  ))}
                </div>
              )}

              {collapsed && (
                <div className="mt-0.5 space-y-0.5 hidden lg:block">
                  {financeItems.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} collapsed={true} />
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ── ตั้งค่า — ล่างสุด ── */}
          {isVisible(settingsItem) && (
            <>
              <div className="mt-1 border-t border-gray-100" />
              <NavLink item={settingsItem} pathname={pathname} collapsed={collapsed} />
            </>
          )}
        </nav>

        {/* Footer copyright */}
        <div className={`flex-shrink-0 border-t border-gray-100 px-3 py-3 ${collapsed ? 'lg:hidden' : ''}`}>
          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            © {new Date().getFullYear()} สร้างโดย{' '}
            <span className="font-semibold text-gray-500">AJ.NUI</span>
          </p>
          <p className="text-[10px] text-gray-300 text-center mt-0.5">v1.4.1</p>
        </div>

      </aside>

      <ProfileModal open={showProfileModal} onClose={() => setShowProfileModal(false)} />

      {/* Logout Confirm Modal */}
      {showLogoutConfirm && (
        <div className="modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="text-center">
              <p className="text-3xl mb-3">🚪</p>
              <h3 className="text-lg font-bold text-gray-900 mb-1">ออกจากระบบ</h3>
              <p className="text-sm text-gray-500">คุณต้องการออกจากระบบใช่หรือไม่?</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                className="btn-secondary flex-1"
                onClick={() => setShowLogoutConfirm(false)}
              >
                ยกเลิก
              </button>
              <button
                className="btn-danger flex-1"
                onClick={() => { setShowLogoutConfirm(false); logout() }}
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
  pathname: string | null
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
      } ${collapsed ? 'lg:justify-center' : ''} ${
        isActive
          ? 'bg-blue-50 text-blue-700 font-semibold'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span className="relative flex-shrink-0">
        <span className={sub ? 'text-sm' : 'text-base'}>{item.icon}</span>
        {badge && collapsed && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className={`flex-1 ${collapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
      {badge && !collapsed && (
        <span className="ml-auto min-w-[20px] h-5 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}
