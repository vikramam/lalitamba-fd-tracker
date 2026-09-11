import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ChevronIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export function ListRow({
  to,
  title,
  subtitle,
  leading,
  middle,
  trailing,
  muted,
  tone,
}: {
  to?: string
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  middle?: ReactNode
  trailing?: ReactNode
  muted?: boolean
  tone?: 'default' | 'warn' | 'danger'
}) {
  const copy = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <p className="type-card-title truncate text-ink">{title}</p>
        {subtitle ? (
          <p
            className={cn(
              'type-small mt-0.5',
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
    </>
  )
  const chevron = to ? (
    <ChevronIcon className="shrink-0 text-[color:var(--text-tertiary)]" />
  ) : null
  const body = (
    <div
      className={cn(
        'surface-card items-center gap-3 px-3.5 py-3.5',
        muted && 'opacity-60',
        middle
          ? 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'
          : 'flex',
      )}
    >
      {middle ? <div className="flex min-w-0 items-center gap-3">{copy}</div> : copy}
      {middle ? <div className="justify-self-center">{middle}</div> : null}
      {trailing || (middle && chevron) ? (
        <div
          className={cn(
            'flex shrink-0 items-center justify-end gap-2 text-right',
            middle && 'justify-self-end',
          )}
        >
          {trailing}
          {middle ? chevron : null}
        </div>
      ) : null}
      {middle ? null : chevron}
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
