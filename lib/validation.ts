export function validateYearMonth(year: unknown, month: unknown): string | null {
  const y = Number(year), m = Number(month)
  if (!Number.isInteger(y) || y < 2000 || y > 2100) return 'ปีไม่ถูกต้อง'
  if (!Number.isInteger(m) || m < 1 || m > 12) return 'เดือนไม่ถูกต้อง'
  return null
}

export function validateAmount(amount: unknown, max = 100_000_000): string | null {
  const a = Number(amount)
  if (!Number.isFinite(a) || a <= 0) return 'ยอดเงินต้องมากกว่า 0'
  if (a > max) return `ยอดเงินต้องไม่เกิน ${max.toLocaleString()} บาท`
  return null
}

export function sanitizeText(text: unknown, maxLen = 500): string | null {
  if (text == null) return null
  const s = String(text).trim().slice(0, maxLen)
  return s || null
}
