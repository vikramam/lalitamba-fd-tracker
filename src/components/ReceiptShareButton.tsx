import { useState } from 'react'

import { useDialog } from '@/hooks/DialogProvider'
import { shareFdReceipt } from '@/lib/receipts'
import type { FdReceipt, Household } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ReceiptShareButton({
  receipt,
  household,
  className,
}: {
  receipt: FdReceipt
  household: Household
  className?: string
}) {
  const { alertError } = useDialog()
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      disabled={busy}
      className={cn('text-[13px] text-accent disabled:opacity-50', className)}
      onClick={() => {
        void (async () => {
          setBusy(true)
          try {
            await shareFdReceipt(receipt, household)
          } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return
            await alertError(cause, 'Could not share that receipt.')
          } finally {
            setBusy(false)
          }
        })()
      }}
    >
      {busy ? 'Sharing…' : 'Share'}
    </button>
  )
}
