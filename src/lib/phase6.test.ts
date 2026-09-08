import { describe, expect, it } from 'vitest'

import monthlyExpected from '../../samples/receipts/lalitamba-fd-01FD40599.expected.json'
import monthlyGemini from '../../samples/receipts/lalitamba-fd-01FD40599.gemini.json'
import maturityExpected from '../../samples/receipts/lalitamba-fd-01FD32450.expected.json'
import maturityGemini from '../../samples/receipts/lalitamba-fd-01FD32450.gemini.json'
import {
  mapLalitambaExtraction,
  parseInterestLine,
} from '@/lib/lalitamba-map'

describe('parseInterestLine', () => {
  it('reads the monthly MS credit line', () => {
    expect(
      parseInterestLine('Interest Rs. 1375/- Monthly CR To MS A/c :01003MS001396'),
    ).toEqual({
      monthly_interest_amount: 1375,
      interest_mode: 'monthly',
      interest_credit_account: '01003MS001396',
    })
  })

  it('reads on-maturity and clears payout fields', () => {
    expect(parseInterestLine('Interest Mode : On Maturity')).toEqual({
      monthly_interest_amount: null,
      interest_mode: 'on_maturity',
      interest_credit_account: null,
    })
  })

  it('accepts quarterly wording we have not seen yet', () => {
    expect(parseInterestLine('Rs. 4000/- Quarterly CR To MS A/c :01003MS001396')).toEqual({
      monthly_interest_amount: null,
      interest_mode: 'quarterly',
      interest_credit_account: '01003MS001396',
    })
  })
})

describe('Lalitamba fixtures', () => {
  it('maps the monthly slip', () => {
    const { fields } = mapLalitambaExtraction(monthlyGemini)
    expect(fields.interest_mode).toBe('monthly')
    expect(fields.monthly_interest_amount).toBe(1375)
    expect(fields.interest_credit_account).toBe('01003MS001396')
    expect(fields.principal_amount).toBe(150000)
    expect(fields.maturity_value).toBe(150000)
    expect(fields.maturity_value).toBe(fields.principal_amount)
    expect(fields.holder_name).toBe('VIKRAM A MULGUND')
    expect(fields.fd_date).toBe('2025-05-26')
    expect(fields.print_at).toBe('2025-05-26T16:12:32+05:30')
    expect(fields.fd_account_no).toBe(monthlyExpected.fd_account_no)
    expect(fields.bank_customer_id).toBe('1700')
  })

  it('maps the on-maturity slip and accepts Maturtiy Value', () => {
    const { fields } = mapLalitambaExtraction(
      maturityGemini,
      String(maturityGemini.raw_text),
    )
    expect(fields.interest_mode).toBe('on_maturity')
    expect(fields.monthly_interest_amount).toBeNull()
    expect(fields.interest_credit_account).toBeNull()
    expect(fields.principal_amount).toBe(450000)
    expect(fields.maturity_value).toBe(697500)
    expect(fields.maturity_date).toBe('2028-10-23')
    expect(fields.fd_account_no).toBe(maturityExpected.fd_account_no)
    expect(fields.tenure_years).toBe(5)
  })

  it('reads Maturtiy Value from raw text alone', () => {
    const { fields } = mapLalitambaExtraction(
      { holder_name: 'VIKRAM A MULGUND' },
      'Maturtiy Value 697500/-\nInterest Mode : On Maturity',
    )
    expect(fields.maturity_value).toBe(697500)
    expect(fields.interest_mode).toBe('on_maturity')
  })
})

describe('secrets', () => {
  it('does not expose a Gemini key to the Vite client', () => {
    expect(import.meta.env.VITE_GEMINI_API_KEY).toBeUndefined()
    expect(import.meta.env.GEMINI_API_KEY).toBeUndefined()
    const env = JSON.stringify(import.meta.env)
    expect(env).not.toMatch(/GEMINI_API_KEY/)
  })
})
