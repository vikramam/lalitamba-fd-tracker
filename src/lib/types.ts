export type FamilyRole = 'family_admin' | 'member'
export type InterestMode =
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'cumulative'
  | 'on_maturity'
  | 'unknown'
export type FdStatus = 'draft' | 'active' | 'matured' | 'closed' | 'renewed'

export type AccountApproval = 'pending' | 'approved' | 'rejected'

export type Profile = {
  id: string
  full_name: string | null
  email: string | null
  is_app_admin: boolean
  is_super_admin?: boolean
  approval_status?: AccountApproval
}

export type ManagedAccount = {
  id: string
  email: string
  full_name: string | null
  approval_status: AccountApproval
  is_app_admin: boolean
  is_super_admin: boolean
}

export type Family = {
  id: string
  name: string
}

export type FamilyMembership = {
  family_id: string
  user_id: string
  role: FamilyRole
  family?: Family
}

export type FamilyMember = {
  id: string
  family_id: string
  full_name: string
  display_name: string | null
  linked_user_id: string | null
  bank_customer_id: string | null
  account_number: string | null
  notes: string | null
}

export type PassbookTxnType = 'credit' | 'debit'
export type PassbookSource = 'manual' | 'fd_interest'

export type MemberPassbook = {
  id: string
  family_id: string
  family_member_id: string
  created_on: string
  created_at: string
}

export type PassbookTransaction = {
  id: string
  family_id: string
  passbook_id: string
  public_id: string
  txn_date: string
  txn_type: PassbookTxnType
  amount: number
  balance_after: number
  reference: string | null
  remarks: string | null
  source_type: PassbookSource
  source_fd_id: string | null
  interest_period_date: string | null
  created_at: string
}

export type FixedDeposit = {
  id: string
  family_id: string
  family_member_id: string
  fd_account_no: string | null
  bank_customer_id: string | null
  holder_name: string | null
  holder_address: string | null
  principal_amount: number
  principal_amount_words: string | null
  interest_rate_pct: number | null
  tenure_years: number
  tenure_months: number
  tenure_days: number
  tenure_label: string | null
  interest_mode: InterestMode
  monthly_interest_amount: number | null
  interest_credit_account: string | null
  maturity_value: number | null
  fd_date: string | null
  transaction_date: string | null
  print_at: string | null
  maturity_date: string | null
  nominee_name: string | null
  nominee_relationship: string | null
  status: FdStatus
  notes: string | null
}

export type FdReceipt = {
  id: string
  family_id: string
  fd_id: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number | null
  uploaded_by: string | null
  is_current: boolean
  created_at: string
  preview_url?: string | null
}

export type OcrFieldReview = {
  id: string
  ocr_run_id: string
  fd_id: string
  field_name: string
  extracted_value: string | null
  confirmed_value: string | null
  was_modified: boolean
  confidence: number | null
}

export type FdRenewal = {
  id: string
  family_id: string
  previous_fd_id: string
  new_fd_id: string
  renewed_on: string
  suggested_carry: number | null
  new_principal: number | null
  notes: string | null
}

export type FdClosure = {
  id: string
  family_id: string
  fd_id: string
  closed_on: string
  amount_received: number | null
  is_premature: boolean
  notes: string | null
}

export type Household = {
  isAppAdmin: boolean
  isSuperAdmin: boolean
  membershipFamilyIds: string[]
  families: Array<Family & { role: FamilyRole | 'app_admin' }>
  members: FamilyMember[]
  deposits: FixedDeposit[]
  receipts: FdReceipt[]
  renewals: FdRenewal[]
  closures: FdClosure[]
  ocrReviews: OcrFieldReview[]
  passbooks: MemberPassbook[]
  passbookTransactions: PassbookTransaction[]
}
