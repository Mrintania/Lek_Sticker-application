'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

const IDLE_WARNING_MS  = 25 * 60 * 1000  // 25 นาที → แสดง warning
const IDLE_LOGOUT_MS   = 30 * 60 * 1000  // 30 นาที → logout
const REFRESH_AFTER_MS = 10 * 60 * 1000  // 10 นาที → refresh token
const WARNING_DURATION = (IDLE_LOGOUT_MS - IDLE_WARNING_MS) / 1000 // 300 วินาที

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

export function useIdleTimeout(logout: () => Promise<void>) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const lastActivityRef   = useRef<number>(Date.now())
  const lastRefreshRef    = useRef<number>(Date.now())
  const warningTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const isWarningRef      = useRef(false)

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current)
    if (countdownRef.current)   clearInterval(countdownRef.current)
    warningTimerRef.current = null
    countdownRef.current    = null
  }, [])

  const startCountdown = useCallback(() => {
    isWarningRef.current = true
    setSecondsLeft(WARNING_DURATION)
    countdownRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!)
          countdownRef.current = null
          logout()
          return null
        }
        return prev - 1
      })
    }, 1000)
  }, [logout])

  const scheduleWarning = useCallback(() => {
    clearTimers()
    isWarningRef.current = false
    warningTimerRef.current = setTimeout(() => {
      startCountdown()
    }, IDLE_WARNING_MS)
  }, [clearTimers, startCountdown])

  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now()
    isWarningRef.current    = false
    setSecondsLeft(null)
    scheduleWarning()
  }, [scheduleWarning])

  // Refresh token ถ้าใช้งานอยู่และเกิน REFRESH_AFTER_MS
  const maybeRefresh = useCallback(() => {
    const now = Date.now()
    if (now - lastRefreshRef.current >= REFRESH_AFTER_MS) {
      lastRefreshRef.current = now
      fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    const handleActivity = () => {
      lastActivityRef.current = Date.now()
      maybeRefresh()
      if (isWarningRef.current) {
        // User กลับมาใช้งานขณะ warning แสดงอยู่ → reset
        resetIdle()
        fetch('/api/auth/refresh', { method: 'POST' }).catch(() => {})
      }
    }

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }))
    scheduleWarning()

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handleActivity))
      clearTimers()
    }
  }, [scheduleWarning, clearTimers, resetIdle, maybeRefresh])

  return {
    isWarning: secondsLeft !== null,
    secondsLeft,
    resetIdle,
  }
}
