import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { logAudit, getIp } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (user) {
    logAudit(getDb(), user.username, 'auth.logout', 'user', null, null, getIp(req))
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set('att_token', '', { maxAge: 0, path: '/' })
  return res
}
