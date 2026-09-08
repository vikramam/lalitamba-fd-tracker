import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ChevronIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export function ListRow({
  to,
  title,
  subtitle,
  leading,
  trailing,
  muted,
  tone,
}: {
  to?: string
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  muted?: boolean
  tone?: 'default' | 'warn' | 'danger'
}) {
  const body = (
    <div
      className={cn(
        'surface-card flex items-center gap-3 px-3.5 py-3.5',
        muted && 'opacity-60',
      )}
    >
      {leading}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{title}</p>
        {subtitle ? (
          <p
            className={cn(
              'mt-0.5 text-[12px]',
              tone === 'danger'
                ? 'text-danger'
                : tone === 'warn'
                  ? 'text-warn'
                  : 'text-muted',
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0 text-right">{trailing}</div> : null}
      {to ? <ChevronIcon className="shrink-0 text-[color:var(--text-tertiary)]" /> : null}
    </div>
  )

  if (!to) return <li>{body}</li>
  return (
    <li>
      <Link to={to} className="block">
        {body}
      </Link>
    </li>
  )
}
