import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ReceiptDownloadButton } from '@/components/ReceiptDownloadButton'
import { ReceiptShareButton } from '@/components/ReceiptShareButton'
import { Shimmer, ShimmerReceiptViewer } from '@/components/Shimmer'
import { useDialog } from '@/hooks/DialogProvider'
import { useHousehold } from '@/hooks/HouseholdProvider'
import { currentReceipt, receiptViewUrl } from '@/lib/receipts'

export function ReceiptViewerPage() {
  const { fdId } = useParams()
  const { household, loading } = useHousehold()
  const { alert } = useDialog()
  const fd = household?.deposits.find((row) => row.id === fdId)
  const receipt = household && fdId ? currentReceipt(household.receipts, fdId) : null
  const [signed, setSigned] = useState<{ url?: string; error?: string }>({})

  useEffect(() => {
    if (!household || !receipt || receipt.preview_url) return
    let cancelled = false
    void receiptViewUrl(receipt, household)
      .then((value) => {
        if (!cancelled) setSigned({ url: value })
      })
      .catch((cause) => {
        if (!cancelled) {
          const message = cause instanceof Error ? cause.message : "You don't have access"
          setSigned({ error: message })
          void alert('Receipt', message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [alert, household, receipt])

  const url = receipt?.preview_url ?? signed.url
  const error = signed.error

  if (loading || !household) {
    return <ShimmerReceiptViewer />
  }

  if (!fd || !receipt) {
    return (
      <main className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-canvas px-5">
        <p className="type-body text-muted">You don't have access</p>
        <Link to={fd ? `/fds/${fd.id}` : '/fds'} className="mt-4 type-body text-accent">
          Back
        </Link>
      </main>
    )
  }

  const isPdf = receipt.mime_type === 'application/pdf'

  return (
    <main className="fixed inset-0 z-20 flex flex-col bg-canvas">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <Link to={`/fds/${fd.id}`} className="shrink-0 type-body text-muted">
          Back
        </Link>
        <p className="type-small type-num min-w-0 truncate text-ink">{receipt.file_name}</p>
        <div className="flex shrink-0 items-center gap-3">
          <ReceiptShareButton receipt={receipt} household={household} />
          <ReceiptDownloadButton receipt={receipt} household={household} />
        </div>
      </div>

      {!url && !error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <Shimmer className="h-full min-h-80 w-full max-w-lg rounded-2xl" />
        </div>
      ) : null}

      {url && isPdf ? (
        <iframe title="Receipt" src={url} className="min-h-0 flex-1 border-0 bg-inner" />
      ) : null}

      {url && !isPdf ? (
        <div className="min-h-0 flex-1 overflow-auto bg-inner" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
          <img src={url} alt="FD receipt" className="mx-auto block max-w-none" />
        </div>
      ) : null}
    </main>
  )
}
