import { describe, expect, it } from 'vitest'

import { sameAuthUser } from '@/lib/auth'

describe('sameAuthUser', () => {
  it('keeps the same person across token refresh objects', () => {
    const left = { id: '1', email: 'vikram@family.test' }
    const right = { id: '1', email: 'vikram@family.test' }
    expect(sameAuthUser(left, right)).toBe(true)
    expect(sameAuthUser(left, { id: '2', email: 'vikram@family.test' })).toBe(false)
    expect(sameAuthUser(null, left)).toBe(false)
  })
})
