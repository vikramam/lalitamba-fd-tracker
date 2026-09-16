export type MemberInput = {
  family_id: string
  full_name: string
  display_name?: string
  bank_customer_id?: string
  account_number?: string
  interest_credit_bank_account?: string
  bank_name?: string
  notes?: string
}

export function normalizeMemberInput(input: MemberInput) {
  const full_name = input.full_name.trim()
  if (!full_name) {
    throw new Error('Name is required.')
  }
  if (!input.family_id) {
    throw new Error('Choose a family.')
  }
  return {
    family_id: input.family_id,
    full_name,
    display_name: input.display_name?.trim() || null,
    bank_customer_id: input.bank_customer_id?.trim() || null,
    account_number: input.account_number?.trim() || null,
    interest_credit_bank_account: input.interest_credit_bank_account?.trim() || null,
    bank_name: input.bank_name?.trim() || null,
    notes: input.notes?.trim() || null,
  }
}
