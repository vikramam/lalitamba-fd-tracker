export const PASSBOOK_PAGE_SIZE = 15

export function publicIdPrefix(date: string) {
  const day = date.slice(0, 10)
  return `PB-${day.slice(2, 4)}${day.slice(5, 7)}${day.slice(8, 10)}-`
}

export function nextPublicId(date: string, existing: string[]) {
  const prefix = publicIdPrefix(date)
  let max = 0
  for (const id of existing) {
    if (!id.startsWith(prefix)) continue
    const n = Number(id.slice(prefix.length))
    if (Number.isFinite(n)) max = Math.max(max, n)
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

export function isPassbookPublicId(value: string) {
  return /^PB-\d{6}-\d{4}$/.test(value)
}
