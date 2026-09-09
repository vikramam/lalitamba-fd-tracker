import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { PlusIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

export function Page({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <main className={cn('page-enter mx-auto w-full max-w-lg flex-1 px-5 py-6 md:px-8', className)}>
      {children}
    </main>
  )
}

export function ScreenTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="type-label">{eyebrow}</p>
        <h1 className="type-page-title mt-1 text-ink">{title}</h1>
      </div>
      {action}
    </div>
  )
}

export function AddIconLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="brand-gradient flex size-9 shrink-0 items-center justify-center rounded-full"
    >
      <PlusIcon className="size-[18px]" />
    </Link>
  )
}

export function BackLink({
  to,
  children = 'Back',
}: {
  to: string
  children?: ReactNode
}) {
  return (
    <Link to={to} className="type-body text-muted">
      {children}
    </Link>
  )
}
