import { describe, expect, it } from 'vitest'

import {
  formatDateLong,
  formatDateShort,
  formatDaysOverdue,
  formatDaysUntil,
  formatDueChip,
} from '@/lib/format'

describe('formatDaysUntil', () => {
  it('keeps today and tomorrow as short labels', () => {
    expect(formatDaysUntil(0)).toBe('Due today')
    expect(formatDaysUntil(1)).toBe('Due tomorrow')
  })

  it('breaks longer waits into years, months, and days', () => {
    expect(formatDaysUntil(777)).toBe('Due in 2 years, 1 month, and 17 days')
    expect(formatDaysUntil(380)).toBe('Due in 1 year and 15 days')
    expect(formatDaysUntil(250)).toBe('Due in 8 months and 10 days')
    expect(formatDaysUntil(45)).toBe('Due in 1 month and 15 days')
    expect(formatDaysUntil(12)).toBe('Due in 12 days')
  })

  it('uses the same breakdown for past due dates', () => {
    expect(formatDaysUntil(-1)).toBe('1 day past')
    expect(formatDaysUntil(-777)).toBe('2 years, 1 month, and 17 days past')
  })
})

describe('formatDueChip', () => {
  it('uses compact units on list tiles', () => {
    expect(formatDueChip(0)).toBe('Today')
    expect(formatDueChip(1)).toBe('Tomorrow')
    expect(formatDueChip(18)).toBe('18d')
    expect(formatDueChip(250)).toBe('8m 10d')
    expect(formatDueChip(380)).toBe('1y 15d')
    expect(formatDueChip(777)).toBe('2y 1m 17d')
    expect(formatDueChip(-5)).toBe('5d overdue')
  })
})

describe('formatDateLong', () => {
  it('prints a readable maturity date', () => {
    expect(formatDateLong('2026-09-29')).toBe('29 Sep 2026')
    expect(formatDateLong('2028-10-28')).toBe('28 Oct 2028')
  })
})

describe('formatDateShort', () => {
  it('prints an ordinal day, short month, and two-digit year', () => {
    expect(formatDateShort('2026-09-08')).toBe('8th Sep 26')
    expect(formatDateShort('2026-09-01')).toBe('1st Sep 26')
    expect(formatDateShort('2026-09-02')).toBe('2nd Sep 26')
    expect(formatDateShort('2026-09-03')).toBe('3rd Sep 26')
    expect(formatDateShort('2026-09-11')).toBe('11th Sep 26')
    expect(formatDateShort('2026-09-21')).toBe('21st Sep 26')
    expect(formatDateShort('2026-09-23')).toBe('23rd Sep 26')
  })
})

describe('formatDaysOverdue', () => {
  it('counts calendar days past the due date', () => {
    expect(formatDaysOverdue(-1)).toBe('1 day overdue')
    expect(formatDaysOverdue(-3)).toBe('3 days overdue')
    expect(formatDaysOverdue(12)).toBe('12 days overdue')
  })
})
