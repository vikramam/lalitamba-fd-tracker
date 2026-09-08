import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { useAuth } from '@/lib/auth'
import { loadHousehold } from '@/lib/household'
import type { Household } from '@/lib/types'

type HouseholdContextValue = {
  household: Household | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const userRef = useRef(user)
  userRef.current = user
  const loadedUserId = useRef<string | null>(null)
  const [household, setHousehold] = useState<Household | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const current = userRef.current
    if (!current) {
      loadedUserId.current = null
      setHousehold(null)
      setLoading(false)
      return
    }
    const silent = loadedUserId.current === current.id
    if (!silent) setLoading(true)
    try {
      const data = await loadHousehold(current)
      loadedUserId.current = current.id
      setHousehold(data)
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

  return (
    <HouseholdContext.Provider value={{ household, loading, error, reload }}>
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
