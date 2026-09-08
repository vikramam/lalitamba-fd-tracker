export const DEMO_IDS = {
  admin: '00000000-0000-4000-8000-000000000001',
  vikram: '00000000-0000-4000-8000-000000000002',
  other: '00000000-0000-4000-8000-000000000003',
  mulgundFamily: '11111111-1111-4111-8111-111111111111',
  otherFamily: '22222222-2222-4222-8222-222222222222',
  vikramMember: '11111111-1111-4111-8111-111111111201',
  otherMember: '22222222-2222-4222-8222-222222222201',
  fd40599: '11111111-1111-4111-8111-111111111301',
  fd32450: '11111111-1111-4111-8111-111111111302',
  otherFd: '22222222-2222-4222-8222-222222222301',
} as const

export function demoUserFromEmail(email: string): {
  id: string
  email: string
  isAppAdmin: boolean
  isSuperAdmin: boolean
} {
  if (email === 'admin@family.test') {
    return { id: DEMO_IDS.admin, email, isAppAdmin: true, isSuperAdmin: true }
  }
  if (email === 'other@family.test') {
    return { id: DEMO_IDS.other, email, isAppAdmin: false, isSuperAdmin: false }
  }
  return { id: DEMO_IDS.vikram, email, isAppAdmin: false, isSuperAdmin: false }
}
