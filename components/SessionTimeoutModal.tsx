'use client'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useIdleTimeout } from '@/hooks/useIdleTimeout'
import { useEscapeKey } from '@/hooks/useEscapeKey'

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function SessionTimeoutModal() {
  const { user, logout } = useCurrentUser()
  const { isWarning, secondsLeft, resetIdle } = useIdleTimeout(logout)
  useEscapeKey(resetIdle, isWarning)

  // ไม่แสดงถ้าไม่ได้ login หรือยังไม่ idle
  if (!user || !isWarning || secondsLeft === null) return null

  const handleStillHere = async () => {
    resetIdle()
    await fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {})
  }

  const urgency = secondsLeft <= 60 // แดง เมื่อเหลือน้อยกว่า 1 นาที

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 ${urgency ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏱️</span>
            <div>
              <h2 className="font-bold text-lg leading-tight">Session กำลังจะหมดอายุ</h2>
              <p className="text-sm opacity-90">คุณไม่ได้ใช้งานระบบสักครู่</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 text-center">
          <p className="text-gray-600 text-sm mb-3">ระบบจะออกจากระบบอัตโนมัติใน</p>
          <div className="flex items-center justify-center gap-1 mb-2">
            {formatCountdown(secondsLeft).split('').map((char, i) => (
              char === ':' ? (
                <span key={i} className={`text-5xl font-mono font-bold ${urgency ? 'text-red-400' : 'text-amber-400'}`}>:</span>
              ) : (
                <span
                  key={`${i}-${char}`}
                  className={`inline-block text-5xl font-mono font-bold tabular-nums w-[1.8ch] text-center
                    ${urgency ? 'text-red-500' : 'text-amber-500'}
                    animate-[countdown_0.3s_ease-out]`}
                >
                  {char}
                </span>
              )
            ))}
          </div>
          <p className="text-gray-400 text-xs">นาที : วินาที</p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button
            onClick={handleStillHere}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-semibold transition-colors"
          >
            ✅ ยังใช้งานอยู่
          </button>
          <button
            onClick={logout}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm transition-colors"
          >
            ออกจากระบบเลย
          </button>
        </div>
      </div>
    </div>
  )
}
