import { useState } from 'react'

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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        className={cn('text-[13px] text-accent disabled:opacity-50', className)}
        onClick={() => {
          void (async () => {
            setError(null)
            setBusy(true)
            try {
              await downloadFdReceipt(receipt, household)
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Could not download that receipt.')
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        {busy ? 'Downloading…' : 'Download'}
      </button>
      {error ? (
        <span className="text-[12px] text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  )
}
