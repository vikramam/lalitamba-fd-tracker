import type { ReactNode } from 'react'

import { Page } from '@/components/Page'
import { cn } from '@/lib/utils'

export function Shimmer({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg', className)} />
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <span className="sr-only">Loading</span>
      {children}
    </div>
  )
}

export function ShimmerRows({
  count = 4,
  withAvatar = false,
}: {
  count?: number
  withAvatar?: boolean
}) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="surface-card flex items-center gap-3 px-3.5 py-3.5">
          {withAvatar ? <Shimmer className="size-7 shrink-0 rounded-lg" /> : null}
          <div className="min-w-0 flex-1 space-y-2">
            <Shimmer className="h-3.5 w-2/5 border-0" />
            <Shimmer className="h-3 w-3/5 border-0" />
          </div>
          <Shimmer className="h-3.5 w-16 shrink-0 border-0" />
        </li>
      ))}
    </ul>
  )
}

export function ShimmerDashboard() {
  return (
    <Page>
      <Screen>
        <Shimmer className="h-8 w-48 rounded-xl border-0" />
        <Shimmer className="mt-2 h-3.5 w-28 border-0" />
        <div className="hero-card mt-6 p-5">
          <Shimmer className="h-3 w-36 border-0" />
          <Shimmer className="mt-3 h-8 w-40 rounded-xl border-0" />
          <Shimmer className="mt-2 h-3 w-24 border-0" />
          <div className="mt-4 grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="surface-card px-2 py-3">
                <Shimmer className="mx-auto h-4 w-12 border-0" />
                <Shimmer className="mx-auto mt-2 h-2.5 w-10 border-0" />
              </div>
            ))}
          </div>
        </div>
        <Shimmer className="mt-8 mb-3 h-3 w-24 border-0" />
        <ShimmerRows count={3} />
      </Screen>
    </Page>
  )
}

export function ShimmerListPage() {
  return (
    <Page>
      <Screen>
        <Shimmer className="h-3 w-16 border-0" />
        <Shimmer className="mt-2 h-6 w-40 rounded-xl border-0" />
        <Shimmer className="mt-3 h-3.5 w-full max-w-sm border-0" />
        <div className="mt-6">
          <ShimmerRows count={5} withAvatar />
        </div>
      </Screen>
    </Page>
  )
}

export function ShimmerFormPage() {
  return (
    <Page>
      <Screen>
        <Shimmer className="h-3.5 w-12 border-0" />
        <Shimmer className="mt-4 h-6 w-32 rounded-xl border-0" />
        <Shimmer className="mt-2 h-3.5 w-64 border-0" />
        <div className="surface-card mt-8 space-y-3 p-4">
          <Shimmer className="h-3 w-16 border-0" />
          <div className="grid grid-cols-2 gap-3">
            <Shimmer className="h-11 rounded-[13px]" />
            <Shimmer className="h-11 rounded-[13px]" />
          </div>
          <Shimmer className="h-32 rounded-2xl" />
        </div>
        <div className="mt-5 space-y-5">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-2">
              <Shimmer className="h-3 w-20 border-0" />
              <Shimmer className="h-11 rounded-[13px]" />
            </div>
          ))}
        </div>
      </Screen>
    </Page>
  )
}

export function ShimmerDetailPage() {
  return (
    <Page>
      <Screen>
        <Shimmer className="h-3.5 w-12 border-0" />
        <Shimmer className="mt-4 h-3 w-16 border-0" />
        <Shimmer className="mt-2 h-7 w-40 rounded-xl border-0" />
        <div className="hero-card mt-6 p-5">
          <Shimmer className="h-3 w-24 border-0" />
          <Shimmer className="mt-3 h-8 w-36 rounded-xl border-0" />
          <Shimmer className="mt-5 h-3 w-14 border-0" />
          <Shimmer className="mt-2 h-3.5 w-40 border-0" />
          <Shimmer className="mt-3 h-3 w-16 border-0" />
          <Shimmer className="mt-2 h-3.5 w-full border-0" />
        </div>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="surface-card mt-4 p-4">
            <Shimmer className="h-3 w-16 border-0" />
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <Shimmer className="h-3 w-20 border-0" />
                <Shimmer className="h-3.5 w-28 border-0" />
              </div>
              <div className="flex items-center justify-between">
                <Shimmer className="h-3 w-16 border-0" />
                <Shimmer className="h-3.5 w-24 border-0" />
              </div>
            </div>
          </div>
        ))}
      </Screen>
    </Page>
  )
}

export function ShimmerSettingsPage() {
  return (
    <Page>
      <Screen>
        <Shimmer className="h-3 w-16 border-0" />
        <Shimmer className="mt-2 h-6 w-28 rounded-xl border-0" />
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="surface-card space-y-3 p-4">
              <Shimmer className="h-3 w-24 border-0" />
              <Shimmer className="h-11 rounded-[13px]" />
              <Shimmer className="h-3.5 w-2/3 border-0" />
            </div>
          ))}
        </div>
      </Screen>
    </Page>
  )
}

export function ShimmerSettingsHome() {
  return (
    <Page>
      <Screen>
        <Shimmer className="h-7 w-32 rounded-xl border-0" />
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Shimmer className="size-9 shrink-0 rounded-xl" />
            <div className="space-y-2">
              <Shimmer className="h-3.5 w-24 border-0" />
              <Shimmer className="h-3 w-20 border-0" />
            </div>
          </div>
          <Shimmer className="h-6 w-20 rounded-full" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="surface-card min-h-[84px] p-3.5">
              <Shimmer className="h-3.5 w-20 border-0" />
              <Shimmer className="mt-2 h-3 w-14 border-0" />
            </div>
          ))}
        </div>
        <div className="surface-card mt-3.5 overflow-hidden">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-3.5 py-3"
            >
              <Shimmer className="h-3.5 w-16 border-0" />
              <Shimmer className="h-6 w-28 rounded-full" />
            </div>
          ))}
        </div>
      </Screen>
    </Page>
  )
}

export function ShimmerAuth() {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center bg-canvas px-5"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="sr-only">Loading</span>
      <div className="w-full max-w-sm">
        <Shimmer className="mx-auto size-24 rounded-full" />
        <Shimmer className="mx-auto mt-4 h-7 w-48 rounded-xl border-0" />
        <Shimmer className="mx-auto mt-2 h-3.5 w-56 border-0" />
        <div className="hero-card mt-8 space-y-5 p-5">
          <Shimmer className="h-3 w-14 border-0" />
          <Shimmer className="h-11 rounded-[13px]" />
          <Shimmer className="h-3 w-16 border-0" />
          <Shimmer className="h-11 rounded-[13px]" />
          <Shimmer className="h-12 rounded-[13px]" />
          <Shimmer className="h-12 rounded-[13px]" />
        </div>
      </div>
    </div>
  )
}

export function ShimmerReceiptViewer() {
  return (
    <main
      className="fixed inset-0 z-20 flex items-center justify-center bg-canvas p-6"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="sr-only">Loading</span>
      <Shimmer className="h-[70vh] w-full max-w-lg rounded-2xl" />
    </main>
  )
}
