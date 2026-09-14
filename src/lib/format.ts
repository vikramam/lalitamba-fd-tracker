export function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(iso: string | null) {
  if (!iso) return '—'
  const day = iso.slice(0, 10)
  const [year, month, date] = day.split('-')
  if (!year || !month || !date) return iso
  return `${date}-${month}-${year}`
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function dayOrdinal(day: number) {
  const teen = day % 100
  if (teen >= 11 && teen <= 13) return `${day}th`
  if (day % 10 === 1) return `${day}st`
  if (day % 10 === 2) return `${day}nd`
  if (day % 10 === 3) return `${day}rd`
  return `${day}th`
}

export function formatDateLong(iso: string | null) {
  if (!iso) return '—'
  const day = iso.slice(0, 10)
  const [year, month, date] = day.split('-')
  if (!year || !month || !date) return iso
  const monthName = MONTH_NAMES[Number(month) - 1]
  if (!monthName) return iso
  return `${date} ${monthName} ${year}`
}

export function formatDateShort(iso: string | null) {
  if (!iso) return '—'
  const day = iso.slice(0, 10)
  const [year, month, date] = day.split('-')
  if (!year || !month || !date) return iso
  const monthName = MONTH_NAMES[Number(month) - 1]
  if (!monthName) return iso
  return `${dayOrdinal(Number(date))} ${monthName} ${year.slice(2)}`
}

export function formatMonthHeading(iso: string | null) {
  if (!iso) return '—'
  const year = iso.slice(0, 4)
  const month = MONTH_FULL[Number(iso.slice(5, 7)) - 1]
  if (!month || year.length !== 4) return iso
  return `${month} ${year}`
}

export function formatDaysOverdue(days: number) {
  const past = Math.abs(days)
  return past === 1 ? '1 day overdue' : `${past} days overdue`
}

export function formatInterestMode(mode: string) {
  if (mode === 'monthly') return 'Monthly'
  if (mode === 'quarterly') return 'Quarterly'
  if (mode === 'on_maturity') return 'On maturity'
  return mode.replaceAll('_', ' ')
}

export function paysOutInterest(mode: string) {
  return mode === 'monthly' || mode === 'quarterly'
}

export function formatStatus(status: string) {
  return status.replaceAll('_', ' ')
}

function unitLabel(count: number, singular: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${singular}s`
}

function formatDuration(days: number) {
  const years = Math.floor(days / 365)
  const afterYears = days % 365
  const months = Math.floor(afterYears / 30)
  const rest = afterYears % 30
  const parts: string[] = []
  if (years > 0) parts.push(unitLabel(years, 'year'))
  if (months > 0) parts.push(unitLabel(months, 'month'))
  if (rest > 0) parts.push(unitLabel(rest, 'day'))
  if (parts.length === 0) return '0 days'
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}`
}

function formatCompactDuration(days: number) {
  const years = Math.floor(days / 365)
  const afterYears = days % 365
  const months = Math.floor(afterYears / 30)
  const rest = afterYears % 30
  const parts: string[] = []
  if (years > 0) parts.push(`${years}y`)
  if (months > 0) parts.push(`${months}m`)
  if (rest > 0) parts.push(`${rest}d`)
  if (parts.length === 0) return '0d'
  return parts.join(' ')
}

export function formatDueChip(days: number) {
  if (days < 0) return `${formatCompactDuration(Math.abs(days))} overdue`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return formatCompactDuration(days)
}

export function formatDaysUntil(days: number) {
  if (days < 0) {
    const past = Math.abs(days)
    return `${formatDuration(past)} past`
  }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${formatDuration(days)}`
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatInrLakhs(amount: number) {
  if (amount >= 100000) {
    const lakhs = amount / 100000
    const rounded = Number.isInteger(lakhs) ? lakhs.toFixed(0) : lakhs.toFixed(1)
    return `₹${rounded} L`
  }
  return formatInr(amount)
}
