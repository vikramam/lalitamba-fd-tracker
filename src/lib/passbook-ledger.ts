import type { PassbookTransaction, PassbookTxnType } from '@/lib/types'

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function sortLedger<T extends { txn_date: string; created_at: string; id: string }>(
  rows: T[],
) {
  return [...rows].sort((left, right) => {
    const byDate = left.txn_date.localeCompare(right.txn_date)
    if (byDate) return byDate
    const byCreated = left.created_at.localeCompare(right.created_at)
    if (byCreated) return byCreated
    return left.id.localeCompare(right.id)
  })
}

export function withRunningBalances<
  T extends {
    txn_date: string
    created_at: string
    id: string
    txn_type: PassbookTxnType
    amount: number
  },
>(rows: T[]): Array<T & { balance_after: number }> {
  let balance = 0
  return sortLedger(rows).map((row) => {
    balance = roundMoney(balance + (row.txn_type === 'credit' ? row.amount : -row.amount))
    return { ...row, balance_after: balance }
  })
}

export function currentBalance(rows: Array<Pick<PassbookTransaction, 'txn_type' | 'amount'>>) {
  return roundMoney(
    rows.reduce(
      (sum, row) => sum + (row.txn_type === 'credit' ? row.amount : -row.amount),
      0,
    ),
  )
}

export function wouldGoNegative(
  existing: PassbookTransaction[],
  draft: Pick<PassbookTransaction, 'id' | 'txn_date' | 'created_at' | 'txn_type' | 'amount'>,
) {
  return withRunningBalances([...existing, draft]).some((row) => row.balance_after < -0.001)
}

export function filterByDateRange<T extends { txn_date: string }>(
  rows: T[],
  from: string | null,
  to: string | null,
) {
  return rows.filter((row) => {
    if (from && row.txn_date < from) return false
    if (to && row.txn_date > to) return false
    return true
  })
}

export function newestFirst<T extends { txn_date: string; created_at: string; id: string }>(
  rows: T[],
) {
  return [...sortLedger(rows)].reverse()
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize) || 1)
  const current = Math.min(Math.max(1, page), pages)
  const start = (current - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    page: current,
    pages,
    total: rows.length,
  }
}

export function groupByMonth<T extends { txn_date: string }>(rows: T[]) {
  const groups: Array<{ key: string; rows: T[] }> = []
  for (const row of rows) {
    const key = row.txn_date.slice(0, 7)
    const last = groups.at(-1)
    if (last?.key === key) last.rows.push(row)
    else groups.push({ key, rows: [row] })
  }
  return groups
}

export function parsePassbookAmount(value: string) {
  const amount = roundMoney(Number(value.replaceAll(',', '').trim()))
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount greater than 0.')
  }
  return amount
}
