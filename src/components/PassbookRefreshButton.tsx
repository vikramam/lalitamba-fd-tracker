import { useState } from 'react'

import { RenewIcon, SpinnerIcon } from '@/components/icons'
import { useDialog } from '@/hooks/DialogProvider'
import {
  formatSyncInterestMessage,
  syncHouseholdPassbookInterest,
} from '@/lib/passbooks'
import type { Household } from '@/lib/types'

export function PassbookRefreshButton({
  household,
  onSynced,
}: {
  household: Household
  onSynced: () => Promise<void>
}) {
  const { alert, alertError } = useDialog()
  const [busy, setBusy] = useState(false)

  async function onRefresh() {
    if (busy) return
    setBusy(true)
    try {
      const { added } = await syncHouseholdPassbookInterest(household)
      await onSynced()
      await alert('Passbooks updated', formatSyncInterestMessage(added))
    } catch (cause) {
      await alertError(cause, 'Could not refresh passbooks.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      aria-label="Refresh passbook interest"
      disabled={busy}
      onClick={() => void onRefresh()}
      className="brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
    >
      {busy ? <SpinnerIcon className="size-[18px]" /> : <RenewIcon className="size-[18px]" />}
    </button>
  )
}
