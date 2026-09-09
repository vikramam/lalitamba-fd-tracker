import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export function Chip({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-xl px-[15px] py-[9px] text-[12.5px] font-bold normal-case disabled:opacity-50',
        selected
          ? 'brand-gradient'
          : 'border border-line bg-surface text-[color:var(--chip-text)]',
      )}
    >
      {children}
    </button>
  )
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}
