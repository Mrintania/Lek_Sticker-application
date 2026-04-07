import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, signToken, COOKIE_OPTIONS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Re-sign token ด้วย payload เดิม → ได้ iat ใหม่ (ต่ออายุ session)
  const { ...rest } = user
  const newToken = signToken(rest)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('att_token', newToken, COOKIE_OPTIONS)
  return res
}
