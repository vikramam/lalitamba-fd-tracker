import { describe, expect, it } from 'vitest'

import { demoDeposits } from '@/lib/demo-data'
import { fdCheckMessages } from '@/lib/fd-checks'
import { DEMO_IDS } from '@/lib/ids'
import { mapLalitambaExtraction } from '@/lib/lalitamba-map'
import {
  buildFieldReviews,
  ocrFieldBadge,
  valuesMatch,
} from '@/lib/ocr-reviews'
import monthlyGemini from '../../samples/receipts/lalitamba-fd-01FD40599.gemini.json'
import maturityGemini from '../../samples/receipts/lalitamba-fd-01FD32450.gemini.json'

describe('ocr badges', () => {
  it('marks an unchanged extracted value as from the receipt', () => {
    expect(
      ocrFieldBadge({
        hasOcr: true,
        extracted: 11,
        current: '11',
        confidence: 0.8,
      }),
    ).toBe('from_receipt')
  })

  it('marks an edited rate as corrected', () => {
    expect(
      ocrFieldBadge({
        hasOcr: true,
        extracted: 11,
        current: '10.5',
        confidence: 0.8,
      }),
    ).toBe('corrected')
  })

  it('asks to check a low-confidence field', () => {
    expect(
      ocrFieldBadge({
        hasOcr: true,
        extracted: '01FD40599',
        current: '01FD40599',
        confidence: 0.4,
      }),
    ).toBe('check_this')
  })

  it('hides badges when OCR did not run', () => {
    expect(
      ocrFieldBadge({
        hasOcr: false,
        extracted: 11,
        current: '11',
        confidence: 0.8,
      }),
    ).toBeNull()
  })
})

describe('ocr field reviews', () => {
  it('flags a modified rate and leaves matching principal alone', () => {
    const monthly = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd40599)!
    const extracted = mapLalitambaExtraction(monthlyGemini).fields
    const reviews = buildFieldReviews({
      ocrRunId: 'run-1',
      fdId: monthly.id,
      extracted,
      confirmed: { ...monthly, interest_rate_pct: 10 },
      confidence: { interest_rate_pct: 0.8, principal_amount: 0.8 },
    })
    expect(reviews.find((row) => row.field_name === 'interest_rate_pct')?.was_modified).toBe(
      true,
    )
    expect(reviews.find((row) => row.field_name === 'principal_amount')?.was_modified).toBe(
      false,
    )
    expect(valuesMatch(extracted.principal_amount, monthly.principal_amount)).toBe(true)
  })

  it('does not warn on the monthly fixture amounts', () => {
    const monthly = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd40599)!
    expect(fdCheckMessages(monthly)).toEqual([])
  })

  it('does not warn on the on-maturity fixture amounts', () => {
    const maturity = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd32450)!
    expect(fdCheckMessages(maturity)).toEqual([])
  })

  it('warns when an on-maturity FD is saved at principal only', () => {
    const maturity = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd32450)!
    expect(fdCheckMessages({ ...maturity, maturity_value: 450000 }).length).toBeGreaterThan(0)
  })

  it('maps the maturity fixture through the review builder', () => {
    const maturity = demoDeposits.find((fd) => fd.id === DEMO_IDS.fd32450)!
    const extracted = mapLalitambaExtraction(
      maturityGemini,
      String(maturityGemini.raw_text),
    ).fields
    const reviews = buildFieldReviews({
      ocrRunId: 'run-2',
      fdId: maturity.id,
      extracted,
      confirmed: maturity,
      confidence: {},
    })
    expect(reviews.find((row) => row.field_name === 'maturity_value')?.was_modified).toBe(
      false,
    )
  })
})
