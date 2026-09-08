import { formatDate, formatInr, formatInterestMode, formatStatus } from '@/lib/format'
import type { FamilyMember, FixedDeposit } from '@/lib/types'

export function fdShareText(fd: FixedDeposit, member?: FamilyMember) {
  const holder = member?.full_name || fd.holder_name || 'Unknown'
  const lines = [
    `FD ${fd.fd_account_no ?? ''}`.trim(),
    holder,
    `Principal ${formatInr(fd.principal_amount)}`,
    fd.interest_rate_pct !== null ? `Rate ${fd.interest_rate_pct}%` : null,
    `Mode ${formatInterestMode(fd.interest_mode)}`,
    fd.fd_date ? `FD date ${formatDate(fd.fd_date)}` : null,
    fd.maturity_date ? `Matures ${formatDate(fd.maturity_date)}` : null,
    fd.maturity_value !== null ? `Maturity ${formatInr(fd.maturity_value)}` : null,
    fd.nominee_name
      ? `Nominee ${fd.nominee_name}${fd.nominee_relationship ? ` · ${fd.nominee_relationship}` : ''}`
      : null,
    `Status ${formatStatus(fd.status)}`,
  ]
  return lines.filter(Boolean).join('\n')
}

export async function shareFdSummary(fd: FixedDeposit, member?: FamilyMember) {
  const text = fdShareText(fd, member)
  const title = fd.fd_account_no ?? 'Fixed deposit'
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title, text })
    return 'shared'
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return 'copied'
  }
  throw new Error('Sharing is not available on this device.')
}
