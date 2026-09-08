import type { FixedDeposit } from '@/lib/types'

function almostEqual(left: number, right: number, rupees = 1) {
  return Math.abs(left - right) <= rupees
}

export function yearsFromDeposit(fd: Pick<
  FixedDeposit,
  'tenure_years' | 'tenure_months' | 'tenure_days' | 'tenure_label' | 'fd_date' | 'maturity_date'
>): number | null {
  if (fd.tenure_years > 0 || fd.tenure_months > 0 || fd.tenure_days > 0) {
    return fd.tenure_years + fd.tenure_months / 12 + fd.tenure_days / 365
  }
  const fromLabel = fd.tenure_label?.match(/(\d+(?:\.\d+)?)/)
  if (fromLabel) return Number(fromLabel[1])
  if (fd.fd_date && fd.maturity_date) {
    const start = Date.parse(fd.fd_date)
    const end = Date.parse(fd.maturity_date)
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return (end - start) / (365.25 * 24 * 60 * 60 * 1000)
    }
  }
  return null
}

export function expectedMonthlyInterest(principal: number, ratePct: number) {
  return (principal * ratePct) / 100 / 12
}

export function expectedQuarterlyInterest(principal: number, ratePct: number) {
  return (principal * ratePct) / 100 / 4
}

export function expectedOnMaturityValue(
  principal: number,
  ratePct: number,
  years: number,
) {
  return principal + (principal * ratePct * years) / 100
}

export function fdCheckMessages(fd: FixedDeposit): string[] {
  const messages: string[] = []
  const rate = fd.interest_rate_pct
  const years = yearsFromDeposit(fd)

  if (fd.interest_mode === 'monthly' || fd.interest_mode === 'quarterly') {
    const period = fd.interest_mode === 'quarterly' ? 'quarter' : 'month'
    if (
      fd.maturity_value !== null &&
      !almostEqual(fd.maturity_value, fd.principal_amount)
    ) {
      messages.push(
        `${fd.interest_mode === 'quarterly' ? 'Quarterly' : 'Monthly'} FDs usually mature at principal because interest is paid out each ${period}.`,
      )
    }
    if (rate !== null && fd.monthly_interest_amount !== null) {
      const expected =
        fd.interest_mode === 'quarterly'
          ? expectedQuarterlyInterest(fd.principal_amount, rate)
          : expectedMonthlyInterest(fd.principal_amount, rate)
      const divisor = fd.interest_mode === 'quarterly' ? 4 : 12
      if (!almostEqual(fd.monthly_interest_amount, expected)) {
        messages.push(
          `${fd.interest_mode === 'quarterly' ? 'Quarterly' : 'Monthly'} interest looks off. ${fd.principal_amount} × ${rate}% / ${divisor} = ${expected.toFixed(2)}.`,
        )
      }
    }
  }

  if (fd.interest_mode === 'on_maturity') {
    if (
      fd.maturity_value !== null &&
      almostEqual(fd.maturity_value, fd.principal_amount)
    ) {
      messages.push(
        'On-maturity FDs usually return principal plus simple interest, not principal alone.',
      )
    }
    if (rate !== null && years !== null && fd.maturity_value !== null) {
      const expected = expectedOnMaturityValue(fd.principal_amount, rate, years)
      if (!almostEqual(fd.maturity_value, expected)) {
        messages.push(
          `Maturity looks off. Simple interest check: ${fd.principal_amount} + ${fd.principal_amount} × ${rate}% × ${Number(years.toFixed(2))} = ${expected.toFixed(0)}.`,
        )
      }
    }
  }

  return messages
}
