'use client'
import { useState, useEffect } from 'react'
import { JWTPayload } from '@/lib/auth'

let cachedUser: JWTPayload | null | undefined = undefined

export function useCurrentUser() {
  const [user, setUser] = useState<JWTPayload | null | undefined>(cachedUser)
  const [loading, setLoading] = useState(cachedUser === undefined)

  useEffect(() => {
    if (cachedUser !== undefined) return
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const u = data?.user ?? null
        cachedUser = u
        setUser(u)
      })
      .finally(() => setLoading(false))
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    cachedUser = null
    setUser(null)
    window.location.href = '/login'
  }

  return { user, loading, logout }
}

export function clearUserCache() {
  cachedUser = undefined
}
