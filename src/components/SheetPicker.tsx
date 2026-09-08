import { useState, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { CheckIcon, ChevronIcon } from '@/components/icons'
import { initials } from '@/lib/initials'
import { cn } from '@/lib/utils'

export function PickerAvatar({
  name,
  children,
}: {
  name?: string
  children?: ReactNode
}) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-inner text-[11px] font-semibold text-ink">
      {children ?? initials(name ?? '')}
    </span>
  )
}

export type SheetPickerOption = {
  id: string
  label: string
  secondary?: string
  leading?: ReactNode
}

export function SheetPicker({
  id,
  title,
  hint,
  valueLabel,
  leading,
  options,
  selectedId,
  onSelect,
  disabled,
  footer,
}: {
  id?: string
  title: string
  hint: string
  valueLabel: string
  leading?: ReactNode
  options: SheetPickerOption[]
  selectedId: string | null
  onSelect: (id: string) => void
  disabled?: boolean
  footer?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-ink">{valueLabel}</span>
          <span className="mt-0.5 block text-[12px] text-muted">{hint}</span>
        </span>
        <ChevronIcon className="shrink-0 text-[color:var(--text-tertiary)]" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={title}>
        <ul className="space-y-1 pt-1">
          {options.map((option) => {
            const selected = selectedId === option.id
            return (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(option.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left',
                    selected ? 'bg-inner' : 'hover:bg-inner',
                  )}
                >
                  {option.leading}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">
                      {option.label}
                    </span>
                    {option.secondary ? (
                      <span className="mt-0.5 block truncate text-[12px] text-muted">
                        {option.secondary}
                      </span>
                    ) : null}
                  </span>
                  {selected ? (
                    <CheckIcon className="size-4 shrink-0 text-accent" />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>

        {footer ? (
          <div className="mt-3 border-t border-line pt-3 pb-1">{footer}</div>
        ) : null}
      </BottomSheet>
    </>
  )
}
