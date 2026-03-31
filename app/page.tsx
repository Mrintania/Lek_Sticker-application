import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch { return null }
}

export default function HomePage() {
  const cookieStore = cookies()
  const token = cookieStore.get('att_token')?.value
  const payload = token ? decodeJwtPayload(token) : null
  if (payload?.role === 'user') redirect('/me')
  redirect('/dashboard')
}
