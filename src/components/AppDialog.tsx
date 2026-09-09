import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/ui/button'

export function AppDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel,
  tone = 'default',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  busy?: boolean
  onConfirm?: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, busy, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="Dismiss"
        className="bottom-sheet-backdrop absolute inset-0 bg-black/50"
        disabled={busy}
        onClick={busy ? undefined : onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="relative w-full max-w-sm rounded-[20px] border border-line bg-surface p-5 shadow-[var(--card-shadow)]"
      >
        <p id={titleId} className="font-display text-[16px] font-semibold tracking-tight text-ink">
          {title}
        </p>
        <p id={messageId} className="mt-2 text-[13px] leading-5 text-muted">
          {message}
        </p>
        <div className="mt-5 flex gap-2">
          {cancelLabel ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={onClose}
            >
              {cancelLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={tone === 'danger' ? 'outline' : 'default'}
            className={cancelLabel ? 'flex-1' : 'w-full'}
            disabled={busy}
            onClick={() => {
              if (onConfirm) onConfirm()
              else onClose()
            }}
          >
            <span className={tone === 'danger' ? 'text-danger' : undefined}>
              {busy ? 'Working…' : confirmLabel}
            </span>
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
