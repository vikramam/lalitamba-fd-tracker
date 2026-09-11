import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

function Input({
  className,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        'type-body flex h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 text-ink placeholder:text-[color:var(--text-faint)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        type === 'date' && 'max-w-full [color-scheme:inherit]',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
