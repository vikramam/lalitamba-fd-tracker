import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import { GroupsClosedIcon, GroupsOpenIcon } from '@/components/icons'
import { cn } from '@/lib/utils'

type CollapseGroupsValue = {
  allOpen: boolean
  revision: number
  setAll: (open: boolean) => void
  scope: string | null
}

const CollapseGroupsContext = createContext<CollapseGroupsValue | null>(null)

// Group state lives outside React so a list reopens the way the user left it.
const openByGroup = new Map<string, boolean>()

export function CollapseGroups({
  children,
  scope,
}: {
  children: ReactNode
  scope?: string
}) {
  const [allOpen, setAllOpen] = useState(true)
  const [revision, setRevision] = useState(0)
  const setAll = useCallback((open: boolean) => {
    setAllOpen(open)
    setRevision((value) => value + 1)
  }, [])
  const value = useMemo(
    () => ({ allOpen, revision, setAll, scope: scope ?? null }),
    [allOpen, revision, setAll, scope],
  )

  return <CollapseGroupsContext.Provider value={value}>{children}</CollapseGroupsContext.Provider>
}

export function useCollapseGroup(defaultOpen = true, id?: string) {
  const ctx = useContext(CollapseGroupsContext)
  const key = ctx?.scope && id ? `${ctx.scope}:${id}` : null
  const [open, setOpenState] = useState(() => {
    const remembered = key ? openByGroup.get(key) : undefined
    if (remembered !== undefined) return remembered
    return ctx && ctx.revision > 0 ? ctx.allOpen : defaultOpen
  })
  const revision = ctx?.revision ?? 0
  const seen = useRef(revision)

  const setOpen = useCallback<Dispatch<SetStateAction<boolean>>>(
    (value) => {
      setOpenState((previous) => {
        const next = typeof value === 'function' ? value(previous) : value
        if (key) openByGroup.set(key, next)
        return next
      })
    },
    [key],
  )

  useEffect(() => {
    if (!ctx) return
    if (seen.current === revision) return
    seen.current = revision
    setOpen(ctx.allOpen)
  }, [ctx, revision, setOpen])

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
