import { useState } from 'react'

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
              await shareFdReceipt(receipt, household)
            } catch (cause) {
              if (cause instanceof Error && cause.name === 'AbortError') return
              setError(cause instanceof Error ? cause.message : 'Could not share that receipt.')
            } finally {
              setBusy(false)
            }
          })()
        }}
      >
        {busy ? 'Sharing…' : 'Share'}
      </button>
      {error ? (
        <span className="text-[12px] text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  )
}
