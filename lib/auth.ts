import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'lek-sticker-secret-key-2025'
const COOKIE_NAME = 'att_token'

export interface JWTPayload {
  userId: number
  username: string
  role: 'admin' | 'manager' | 'user'
  employeeId?: string
  fullName?: string
}

export const SESSION_DURATION_SEC = 60 * 60 * 8 // 8 ชั่วโมง

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JWTPayload
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null
}

export function getUserFromRequest(req: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(req)
  if (!token) return null
  return verifyToken(token)
}

export function canManage(role: string): boolean {
  return role === 'admin' || role === 'manager'
}

export function isAdmin(role: string): boolean {
  return role === 'admin'
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: SESSION_DURATION_SEC,
  path: '/',
}
