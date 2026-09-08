import { useId, useRef, useState } from 'react'

import { CameraIcon, PhotoIcon, SpinnerIcon } from '@/components/icons'
import { Shimmer } from '@/components/Shimmer'
import { Button } from '@/components/ui/button'
import { formatFileSize } from '@/lib/format'
import {
  CAMERA_ACCEPT,
  GALLERY_ACCEPT,
  prepareReceiptFile,
  type PreparedReceipt,
} from '@/lib/receipt-file'
import type { FdReceipt } from '@/lib/types'

export function ReceiptPicker({
  value,
  existing,
  onChange,
  disabled,
  busy = false,
  busyLabel = 'Reading receipt…',
}: {
  value: PreparedReceipt | null
  existing?: FdReceipt | null
  onChange: (value: PreparedReceipt | null) => void
  disabled?: boolean
  busy?: boolean
  busyLabel?: string
}) {
  const cameraId = useId()
  const galleryId = useId()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)

  async function onPick(file: File | undefined) {
    if (!file) return
    setError(null)
    setPreparing(true)
    try {
      if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl)
      onChange(await prepareReceiptFile(file))
    } catch (cause) {
      onChange(null)
      setError(cause instanceof Error ? cause.message : 'Could not prepare that photo.')
    } finally {
      setPreparing(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (galleryRef.current) galleryRef.current.value = ''
    }
  }

  return (
    <div className="surface-card space-y-3 p-4">
      <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
        Receipt
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || preparing}
          onClick={() => cameraRef.current?.click()}
        >
          <CameraIcon className="size-4" />
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || preparing}
          onClick={() => galleryRef.current?.click()}
        >
          <PhotoIcon className="size-4" />
          From gallery
        </Button>
      </div>
      <p className="text-[12px] text-muted">
        Rear camera or a photo already on this phone. Photos are compressed here;
        HEIF becomes JPEG.
      </p>

      <input
        id={cameraId}
        ref={cameraRef}
        type="file"
        accept={CAMERA_ACCEPT}
        capture="environment"
        className="sr-only"
        onChange={(event) => void onPick(event.target.files?.[0])}
      />
      <input
        id={galleryId}
        ref={galleryRef}
        type="file"
        accept={GALLERY_ACCEPT}
        className="sr-only"
        onChange={(event) => void onPick(event.target.files?.[0])}
      />

      {preparing || (busy && !value) ? (
        <ReceiptBusy label={preparing ? 'Preparing photo…' : busyLabel} />
      ) : null}

      {value && !preparing ? (
        <div className="border-t border-line pt-3">
          {value.previewUrl ? (
            <div className="relative">
              <img
                src={value.previewUrl}
                alt="Receipt preview"
                className={`max-h-48 w-full rounded-2xl object-contain ${busy ? 'opacity-35' : ''}`}
              />
              {busy ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
                  <ReceiptBusy label={busyLabel} compact />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {busy ? <SpinnerIcon className="size-5 text-accent" /> : null}
              <p className="text-[13px] text-ink">{value.file.name}</p>
            </div>
          )}
          <p className="mt-2 font-mono text-[11px] text-muted">{value.originalName}</p>
          <p className="mt-1 text-[12px] text-muted">
            {value.originalSize > value.file.size
              ? `Compressed ${formatFileSize(value.originalSize)} → ${formatFileSize(value.file.size)}`
              : formatFileSize(value.file.size)}
          </p>
          {!value.previewUrl && busy ? (
            <p className="mt-2 text-[13px] text-muted">{busyLabel}</p>
          ) : null}
          {busy ? null : (
            <button
              type="button"
              className="mt-2 text-[13px] text-accent"
              onClick={() => {
                if (value.previewUrl) URL.revokeObjectURL(value.previewUrl)
                onChange(null)
              }}
            >
              Remove
            </button>
          )}
        </div>
      ) : existing ? (
        <p className="text-[13px] text-muted">
          Current file: {existing.file_name}. Choosing a new one replaces it.
        </p>
      ) : null}

      {error ? (
        <p className="text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function ReceiptBusy({ label, compact = false }: { label: string; compact?: boolean }) {
  if (compact) {
    return (
      <div
        className="flex flex-col items-center gap-2 rounded-2xl bg-[var(--bar-bg)] px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <SpinnerIcon className="size-7 text-accent" />
        <p className="text-[13px] font-semibold text-ink">{label}</p>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-2xl" role="status" aria-live="polite">
      <Shimmer className="min-h-32 w-full rounded-2xl" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <SpinnerIcon className="size-8 text-accent" />
        <p className="text-[13px] font-semibold text-ink">{label}</p>
      </div>
    </div>
  )
}
