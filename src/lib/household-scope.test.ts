import { describe, expect, it } from 'vitest'

import { demoHousehold } from '@/lib/household'
import {
  ALL_FAMILIES_SCOPE,
  defaultFamilyScope,
  resolveFamilyScope,
  scopeHousehold,
} from '@/lib/household-scope'
import { DEMO_IDS } from '@/lib/ids'

describe('family scope', () => {
  it('defaults a super admin to their own family', () => {
    const household = demoHousehold('admin@family.test')
    expect(household.membershipFamilyIds).toEqual([DEMO_IDS.mulgundFamily])
    expect(defaultFamilyScope(household)).toBe(DEMO_IDS.mulgundFamily)
    expect(household.families).toHaveLength(2)
  })

  it('keeps a regular member on all of their families', () => {
    const household = demoHousehold('vikram@family.test')
    expect(defaultFamilyScope(household)).toBe(ALL_FAMILIES_SCOPE)
  })

  it('filters deposits and members to one family', () => {
    const household = demoHousehold('admin@family.test')
    const scoped = scopeHousehold(household, DEMO_IDS.mulgundFamily)
    expect(scoped.families.map((family) => family.id)).toEqual([DEMO_IDS.mulgundFamily])
    expect(scoped.deposits.every((fd) => fd.family_id === DEMO_IDS.mulgundFamily)).toBe(true)
    expect(scoped.members.every((member) => member.family_id === DEMO_IDS.mulgundFamily)).toBe(true)
    expect(scoped.deposits.length).toBeLessThan(household.deposits.length)
  })

  it('restores all families and ignores a stale stored id', () => {
    const household = demoHousehold('admin@family.test')
    expect(scopeHousehold(household, ALL_FAMILIES_SCOPE).deposits).toHaveLength(
      household.deposits.length,
    )
    expect(resolveFamilyScope(household, 'missing')).toBe(DEMO_IDS.mulgundFamily)
    expect(resolveFamilyScope(household, ALL_FAMILIES_SCOPE)).toBe(ALL_FAMILIES_SCOPE)
  })
})
