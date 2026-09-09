import { useState } from 'react'

import { useDialog } from '@/hooks/DialogProvider'
import { downloadFdReceipt } from '@/lib/receipts'
import type { FdReceipt, Household } from '@/lib/types'
import { cn } from '@/lib/utils'

export function ReceiptDownloadButton({
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
            await downloadFdReceipt(receipt, household)
          } catch (cause) {
            await alertError(cause, 'Could not download that receipt.')
          } finally {
            setBusy(false)
          }
        })()
      }}
    >
      {busy ? 'Downloading…' : 'Download'}
    </button>
  )
}
