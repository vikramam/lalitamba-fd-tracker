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
        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-muted uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1 font-display text-[20px] font-bold tracking-tight text-ink">
          {title}
        </h1>
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
    <Link to={to} className="text-[13px] text-muted">
      {children}
    </Link>
  )
}
