import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { GroupsClosedIcon, GroupsOpenIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

type CollapseGroupsValue = {
  allOpen: boolean
  revision: number
  setAll: (open: boolean) => void
}

const CollapseGroupsContext = createContext<CollapseGroupsValue | null>(null)

export function CollapseGroups({ children }: { children: ReactNode }) {
  const [allOpen, setAllOpen] = useState(true)
  const [revision, setRevision] = useState(0)
  const setAll = useCallback((open: boolean) => {
    setAllOpen(open)
    setRevision((value) => value + 1)
  }, [])
  const value = useMemo(
    () => ({ allOpen, revision, setAll }),
    [allOpen, revision, setAll],
  )

  return <CollapseGroupsContext.Provider value={value}>{children}</CollapseGroupsContext.Provider>
}

export function useCollapseGroup(defaultOpen = true) {
  const ctx = useContext(CollapseGroupsContext)
  const [open, setOpen] = useState(defaultOpen)
  const revision = ctx?.revision ?? 0

  useEffect(() => {
    if (!ctx) return
    setOpen(ctx.allOpen)
  }, [ctx, revision])

  return [open, setOpen] as const
}

export function CollapseAllControls({
  className,
  boxed,
}: {
  className?: string
  boxed?: boolean
}) {
  const ctx = useContext(CollapseGroupsContext)
  if (!ctx) return null
  const hide = ctx.allOpen
  const label = hide ? 'Hide all' : 'Expand all'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => ctx.setAll(!hide)}
      className={cn(
        'flex shrink-0 items-center justify-center text-accent',
        boxed
          ? 'h-11 w-11 rounded-xl border border-line bg-surface'
          : 'size-8 rounded-lg',
        className,
      )}
    >
      {hide ? <GroupsOpenIcon className="size-5" /> : <GroupsClosedIcon className="size-5" />}
    </button>
  )
}
