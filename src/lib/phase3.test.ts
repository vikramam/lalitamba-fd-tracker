import { afterEach, describe, expect, it } from 'vitest'

import { demoMembers } from '@/lib/demo-data'
import {
  addDemoFamily,
  addDemoMember,
  resetDemoStore,
  updateDemoFamily,
  updateDemoMember,
} from '@/lib/demo-store'
import { demoHousehold } from '@/lib/household'
import { DEMO_IDS } from '@/lib/ids'
import { normalizeMemberInput } from '@/lib/member-input'
import {
  canManageMembers,
  deleteFamily,
  deleteMember,
  familyDeleteError,
  memberDeleteError,
} from '@/lib/members'
import { canResetTestData, resetTestData } from '@/lib/reset-test-data'

const memory = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
  },
})

afterEach(() => {
  resetDemoStore()
  memory.clear()
})

describe('normalizeMemberInput', () => {
  it('rejects an empty name', () => {
    expect(() =>
      normalizeMemberInput({
        family_id: DEMO_IDS.mulgundFamily,
        full_name: '   ',
      }),
    ).toThrow('Name is required.')
  })

  it('rejects a missing family', () => {
    expect(() =>
      normalizeMemberInput({
        family_id: '',
        full_name: 'Amrutmati Vikram Mulgund',
      }),
    ).toThrow('Choose a family.')
  })

  it('trims fields', () => {
    expect(
      normalizeMemberInput({
        family_id: DEMO_IDS.mulgundFamily,
        full_name: '  Amrutmati Vikram Mulgund  ',
        display_name: ' Amrutmati ',
        bank_customer_id: ' 1700 ',
        notes: ' wife ',
      }),
    ).toEqual({
      family_id: DEMO_IDS.mulgundFamily,
      full_name: 'Amrutmati Vikram Mulgund',
      display_name: 'Amrutmati',
      bank_customer_id: '1700',
      notes: 'wife',
    })
  })
})

describe('household isolation', () => {
  it('lets a family admin add a member that the other family cannot see', () => {
    addDemoMember({
      family_id: DEMO_IDS.mulgundFamily,
      full_name: 'Amrutmati Vikram Mulgund',
      display_name: 'Amrutmati',
      bank_customer_id: '1700',
      notes: null,
    })

    const vikram = demoHousehold('vikram@family.test')
    const other = demoHousehold('other@family.test')
    const admin = demoHousehold('admin@family.test')

    expect(vikram.members.map((member) => member.full_name)).toContain(
      'Amrutmati Vikram Mulgund',
    )
    expect(other.members.map((member) => member.full_name)).toEqual(['Other Holder'])
    expect(other.members.map((member) => member.full_name)).not.toContain(
      'Vikram A Mulgund',
    )
    expect(admin.members.map((member) => member.full_name)).toContain(
      'Amrutmati Vikram Mulgund',
    )
  })

  it('lets a signed-in user create a family that stays in their scope', () => {
    const family = addDemoFamily('New household', DEMO_IDS.vikram)
    addDemoMember({
      family_id: family.id,
      full_name: 'Shakuntala A Mulgund',
      display_name: null,
      bank_customer_id: null,
      notes: null,
    })

    const vikram = demoHousehold('vikram@family.test')
    const other = demoHousehold('other@family.test')

    expect(vikram.families.map((row) => row.name)).toContain('New household')
    expect(vikram.members.map((member) => member.full_name)).toContain(
      'Shakuntala A Mulgund',
    )
    expect(other.families.map((row) => row.name)).not.toContain('New household')
    expect(other.members.map((member) => member.full_name)).not.toContain(
      'Shakuntala A Mulgund',
    )
  })

  it('renames a seed family without duplicating it', () => {
    updateDemoFamily(DEMO_IDS.mulgundFamily, 'Mulgund household')
    const vikram = demoHousehold('vikram@family.test')
    const matches = vikram.families.filter((family) => family.id === DEMO_IDS.mulgundFamily)
    expect(matches).toHaveLength(1)
    expect(matches[0]?.name).toBe('Mulgund household')
  })

  it('updates a seed member without duplicating them', () => {
    const seed = demoMembers[0]
    updateDemoMember(seed.id, {
      full_name: seed.full_name,
      display_name: 'Vik',
      bank_customer_id: seed.bank_customer_id,
      notes: 'self',
    })

    const vikram = demoHousehold('vikram@family.test')
    const matches = vikram.members.filter((member) => member.id === seed.id)
    expect(matches).toHaveLength(1)
    expect(matches[0]?.display_name).toBe('Vik')
    expect(matches[0]?.notes).toBe('self')
  })
})

describe('deleteFamily', () => {
  it('refuses a family that still has people or FDs', () => {
    const household = demoHousehold('vikram@family.test')
    expect(familyDeleteError(household, DEMO_IDS.mulgundFamily)).toMatch(/person|FD/)
    return expect(deleteFamily(household, DEMO_IDS.mulgundFamily)).rejects.toThrow(
      /still has/,
    )
  })

  it('deletes an empty family after the check passes', async () => {
    const family = addDemoFamily('Empty household', DEMO_IDS.vikram)
    const household = demoHousehold('vikram@family.test')
    expect(familyDeleteError(household, family.id)).toBeNull()
    await deleteFamily(household, family.id)
    expect(demoHousehold('vikram@family.test').families.map((row) => row.id)).not.toContain(
      family.id,
    )
  })
})

describe('deleteMember', () => {
  it('refuses a person who still has FDs', () => {
    const household = demoHousehold('vikram@family.test')
    expect(memberDeleteError(household, DEMO_IDS.vikramMember)).toMatch(/FD/)
    return expect(deleteMember(household, DEMO_IDS.vikramMember)).rejects.toThrow(/still have/)
  })

  it('deletes a person with no FDs after the check passes', async () => {
    const member = addDemoMember({
      family_id: DEMO_IDS.mulgundFamily,
      full_name: 'Empty Person',
      display_name: null,
      bank_customer_id: null,
      notes: null,
    })
    const household = demoHousehold('vikram@family.test')
    expect(memberDeleteError(household, member.id)).toBeNull()
    await deleteMember(household, member.id)
    expect(demoHousehold('vikram@family.test').members.map((row) => row.id)).not.toContain(
      member.id,
    )
  })
})

describe('canManageMembers', () => {
  it('is true for a first-time user with no family', () => {
    expect(canManageMembers({ isAppAdmin: false, families: [] })).toBe(true)
  })

  it('is true for a family admin and false for a viewer', () => {
    expect(
      canManageMembers({
        isAppAdmin: false,
        families: [{ role: 'family_admin' }],
      }),
    ).toBe(true)
    expect(
      canManageMembers({
        isAppAdmin: false,
        families: [{ role: 'member' }],
      }),
    ).toBe(false)
  })
})

describe('reset test data', () => {
  it('lets a family admin clear local demo extras', async () => {
    const vikram = demoHousehold('vikram@family.test')
    expect(canResetTestData(vikram)).toBe(true)
    addDemoMember({
      family_id: DEMO_IDS.mulgundFamily,
      full_name: 'Temp Member',
      display_name: null,
      bank_customer_id: null,
      notes: null,
    })
    await resetTestData(vikram)
    expect(
      demoHousehold('vikram@family.test').members.map((member) => member.full_name),
    ).not.toContain('Temp Member')
  })
})
