import { interestCreditedToDate } from '@/lib/dashboard'
import { formatDate, formatInterestMode, formatStatus } from '@/lib/format'
import { currentReceipt } from '@/lib/receipt-map'
import type { Household } from '@/lib/types'
import { buildXlsx, downloadXlsx, type ExcelSheet } from '@/lib/xlsx'

function text(value: string | null | undefined) {
  return value?.trim() || ''
}

function dateCell(iso: string | null | undefined) {
  const formatted = formatDate(iso ?? null)
  return formatted === '—' ? '' : formatted
}

function familyName(household: Household, familyId: string) {
  return household.families.find((family) => family.id === familyId)?.name ?? ''
}

function memberName(household: Household, memberId: string) {
  const member = household.members.find((row) => row.id === memberId)
  return member?.display_name || member?.full_name || ''
}

function periodLabel(fd: Household['deposits'][number]) {
  if (fd.tenure_label) return fd.tenure_label
  const parts = [
    fd.tenure_years ? `${fd.tenure_years}y` : '',
    fd.tenure_months ? `${fd.tenure_months}m` : '',
    fd.tenure_days ? `${fd.tenure_days}d` : '',
  ].filter(Boolean)
  return parts.join(' ')
}

function fdAccount(household: Household, fdId: string) {
  const fd = household.deposits.find((row) => row.id === fdId)
  return fd?.fd_account_no ?? fdId
}

export function householdExcelSheets(household: Household): ExcelSheet[] {
  const deposits = [...household.deposits].sort((left, right) => {
    const byMember = memberName(household, left.family_member_id).localeCompare(
      memberName(household, right.family_member_id),
    )
    if (byMember) return byMember
    return (left.fd_account_no ?? '').localeCompare(right.fd_account_no ?? '')
  })

  return [
    {
      name: 'FDs',
      rows: [
        [
          'Family',
          'Member',
          'FD account',
          'CID',
          'Holder',
          'Address',
          'Principal',
          'Principal in words',
          'Rate %',
          'Period',
          'Interest mode',
          'Payout',
          'MS account',
          'Maturity value',
          'Interest credited',
          'Credited months',
          'FD date',
          'Txn date',
          'Matures on',
          'Nominee',
          'Relationship',
          'Status',
          'Notes',
          'Receipt',
        ],
        ...deposits.map((fd) => {
          const credit = interestCreditedToDate(fd)
          const receipt = currentReceipt(household.receipts, fd.id)
          return [
            familyName(household, fd.family_id),
            memberName(household, fd.family_member_id),
            text(fd.fd_account_no),
            text(fd.bank_customer_id),
            text(fd.holder_name),
            text(fd.holder_address),
            fd.principal_amount,
            text(fd.principal_amount_words),
            fd.interest_rate_pct,
            periodLabel(fd),
            formatInterestMode(fd.interest_mode),
            fd.monthly_interest_amount,
            text(fd.interest_credit_account),
            fd.maturity_value,
            credit?.amount ?? '',
            credit?.months ?? '',
            dateCell(fd.fd_date),
            dateCell(fd.transaction_date),
            dateCell(fd.maturity_date),
            text(fd.nominee_name),
            text(fd.nominee_relationship),
            formatStatus(fd.status),
            text(fd.notes),
            text(receipt?.file_name),
          ]
        }),
      ],
    },
    {
      name: 'People',
      rows: [
        ['Family', 'Name', 'Display name', 'CID', 'Notes'],
        ...[...household.members]
          .sort((left, right) => left.full_name.localeCompare(right.full_name))
          .map((member) => [
            familyName(household, member.family_id),
            member.full_name,
            text(member.display_name),
            text(member.bank_customer_id),
            text(member.notes),
          ]),
      ],
    },
    {
      name: 'Closures',
      rows: [
        ['Family', 'FD account', 'Closed on', 'Amount received', 'Premature', 'Notes'],
        ...household.closures.map((row) => [
          familyName(household, row.family_id),
          fdAccount(household, row.fd_id),
          dateCell(row.closed_on),
          row.amount_received,
          row.is_premature,
          text(row.notes),
        ]),
      ],
    },
    {
      name: 'Renewals',
      rows: [
        ['Family', 'Previous FD', 'New FD', 'Renewed on', 'Suggested carry', 'New principal', 'Notes'],
        ...household.renewals.map((row) => [
          familyName(household, row.family_id),
          fdAccount(household, row.previous_fd_id),
          fdAccount(household, row.new_fd_id),
          dateCell(row.renewed_on),
          row.suggested_carry,
          row.new_principal,
          text(row.notes),
        ]),
      ],
    },
    {
      name: 'Receipts',
      rows: [
        ['Family', 'FD account', 'File name', 'Type', 'Size', 'Current', 'Uploaded'],
        ...household.receipts.map((row) => [
          familyName(household, row.family_id),
          fdAccount(household, row.fd_id),
          row.file_name,
          row.mime_type,
          row.file_size,
          row.is_current,
          dateCell(row.created_at.slice(0, 10)),
        ]),
      ],
    },
  ]
}

export function exportHouseholdExcel(household: Household, now = new Date()) {
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  downloadXlsx(buildXlsx(householdExcelSheets(household)), `Lalitamba-FDs-${stamp}.xlsx`)
}
