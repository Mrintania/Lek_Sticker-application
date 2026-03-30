'use client'
import { create } from 'zustand'
import { AttendanceRecord, WorkSettings, DEFAULT_SETTINGS } from '@/lib/types'

interface AttendanceState {
  master: AttendanceRecord[]
  settings: WorkSettings
  isLoaded: boolean

  loadAttendance: (start?: string, end?: string, employeeId?: string) => Promise<void>
  loadSettings: () => Promise<void>
  clearAttendance: () => void
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  master: [],
  settings: DEFAULT_SETTINGS,
  isLoaded: false,

  loadAttendance: async (start, end, employeeId) => {
    const params = new URLSearchParams()
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    if (employeeId) params.set('employeeId', employeeId)
    const res = await fetch(`/api/attendance?${params}`)
    if (!res.ok) return
    const data = await res.json()
    // Rehydrate Date objects
    const master: AttendanceRecord[] = data.map((r: AttendanceRecord & { checkIn: string | null; checkOut: string | null; allScans: string[] }) => ({
      ...r,
      checkIn: r.checkIn ? new Date(r.checkIn) : null,
      checkOut: r.checkOut ? new Date(r.checkOut) : null,
      allScans: r.allScans.map((s: string) => new Date(s)),
    }))
    set({ master, isLoaded: true })
  },

  loadSettings: async () => {
    const res = await fetch('/api/settings')
    if (!res.ok) return
    const settings = await res.json()
    set({ settings })
  },

  clearAttendance: () => set({ master: [], isLoaded: false }),
}))
