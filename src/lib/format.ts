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

export function formatDaysUntil(days: number) {
  if (days < 0) {
    const past = Math.abs(days)
    return past === 1 ? '1 day past' : `${past} days past`
  }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
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
