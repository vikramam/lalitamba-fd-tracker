import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useAuth } from '@/lib/auth'
import { loadHousehold } from '@/lib/household'
import {
  ALL_FAMILIES_SCOPE,
  readStoredFamilyScope,
  resolveFamilyScope,
  scopeHousehold,
  writeStoredFamilyScope,
} from '@/lib/household-scope'
import type { Family, FamilyRole, Household } from '@/lib/types'

type HouseholdContextValue = {
  household: Household | null
  allHousehold: Household | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  familyScope: string
  setFamilyScope: (scope: string) => void
  allFamilies: Array<Family & { role: FamilyRole | 'app_admin' }>
  canSwitchFamily: boolean
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const userRef = useRef(user)
  userRef.current = user
  const loadedUserId = useRef<string | null>(null)
  const [allHousehold, setAllHousehold] = useState<Household | null>(null)
  const [familyScope, setFamilyScopeState] = useState(ALL_FAMILIES_SCOPE)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const current = userRef.current
    if (!current) {
      loadedUserId.current = null
      setAllHousehold(null)
      setFamilyScopeState(ALL_FAMILIES_SCOPE)
      setLoading(false)
      return
    }
    const silent = loadedUserId.current === current.id
    if (!silent) setLoading(true)
    try {
      const data = await loadHousehold(current)
      loadedUserId.current = current.id
      setAllHousehold(data)
      setFamilyScopeState(resolveFamilyScope(data, readStoredFamilyScope(current.id)))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, userId])

  const setFamilyScope = useCallback(
    (scope: string) => {
      if (!allHousehold || !userId) return
      const next = resolveFamilyScope(allHousehold, scope)
      setFamilyScopeState(next)
      writeStoredFamilyScope(userId, next)
    },
    [allHousehold, userId],
  )

  const household = useMemo(() => {
    if (!allHousehold) return null
    return scopeHousehold(allHousehold, familyScope)
  }, [allHousehold, familyScope])

  const allFamilies = allHousehold?.families ?? []
  const canSwitchFamily = Boolean(allHousehold?.isAppAdmin && allFamilies.length > 1)

  return (
    <HouseholdContext.Provider
      value={{
        household,
        allHousehold,
        loading,
        error,
        reload,
        familyScope,
        setFamilyScope,
        allFamilies,
        canSwitchFamily,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const context = useContext(HouseholdContext)
  if (!context) {
    throw new Error('useHousehold must be used within HouseholdProvider')
  }
  return context
}
