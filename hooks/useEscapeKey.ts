'use client'
import { useEffect } from 'react'

/**
 * ปิด modal เมื่อกด ESC
 * @param onClose - ฟังก์ชันปิด modal
 * @param enabled - เปิดใช้งานเมื่อ modal แสดงอยู่ (default: true)
 */
export function useEscapeKey(onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, enabled])
}
