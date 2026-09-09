import { useEffect, useId, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  maxWidth = 560,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: ReactNode
  maxWidth?: number
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="bottom-sheet-backdrop absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className="bottom-sheet-panel relative flex max-h-[88vh] w-full flex-col rounded-t-[24px] border border-line bg-surface"
        style={{ maxWidth }}
      >
        <div
          className={cn(
            'mx-auto mt-1.5 h-1 w-9 rounded-full bg-line',
            title ? 'mb-1' : 'mb-1.5',
          )}
        />

        {title ? (
          <div className="flex items-center justify-between gap-3 px-5 pb-2">
            <p id={titleId} className="type-card-title">
              {title}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-inner hover:text-ink"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="overflow-y-auto px-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
