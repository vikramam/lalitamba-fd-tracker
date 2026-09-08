import { describe, expect, it } from 'vitest'

import { householdExcelSheets } from '@/lib/export-household'
import { demoHousehold } from '@/lib/household'
import { buildXlsx } from '@/lib/xlsx'

describe('household Excel export', () => {
  it('puts every visible FD on the FDs sheet', () => {
    const sheets = householdExcelSheets(demoHousehold('vikram@family.test'))
    const fds = sheets.find((sheet) => sheet.name === 'FDs')
    const people = sheets.find((sheet) => sheet.name === 'People')
    expect(fds?.rows[0]?.[2]).toBe('FD account')
    expect(fds?.rows.some((row) => row.includes('01FD40599'))).toBe(true)
    expect(fds?.rows.some((row) => row.includes('01FD32450'))).toBe(true)
    expect(people?.rows.some((row) => row.includes('Vikram A Mulgund'))).toBe(true)
    expect(fds?.rows.some((row) => row.includes('Other Holder'))).toBe(false)
  })

  it('builds a zip Excel file that contains the sheet names', () => {
    const bytes = buildXlsx(householdExcelSheets(demoHousehold('vikram@family.test')))
    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe('PK\u0003\u0004')
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('sheet name="FDs"')
    expect(text).toContain('01FD40599')
    expect(text).toContain('Mulgund Complex, Gadag')
  })

  it('escapes XML in cell text', () => {
    const text = new TextDecoder().decode(
      buildXlsx([{ name: 'Notes', rows: [['A & B <C>']] }]),
    )
    expect(text).toContain('A &amp; B &lt;C&gt;')
  })
})
