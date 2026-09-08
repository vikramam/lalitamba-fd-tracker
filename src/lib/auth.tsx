import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { approvalMessage, readOwnApproval, registerDemoSignup } from '@/lib/accounts'
import { findDemoAccount } from '@/lib/demo-accounts'
import { hasSupabaseConfig, supabase } from '@/lib/supabase'

const DEMO_KEY = 'nidhi.demo.session'

export type AuthUser = {
  id: string
  email: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  mode: 'supabase' | 'demo'
  recovery: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string; pending?: boolean }>
  signUp: (email: string, password: string) => Promise<{ error?: string; pending?: boolean }>
  requestPasswordReset: (email: string) => Promise<{ error?: string }>
  updatePassword: (password: string) => Promise<{ error?: string; pending?: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function sameAuthUser(left: AuthUser | null, right: AuthUser | null) {
  return left?.id === right?.id && left?.email === right?.email
}

function userFromSession(session: { user?: { id: string; email?: string | null } } | null): AuthUser | null {
  const sessionUser = session?.user
  return sessionUser?.email ? { id: sessionUser.id, email: sessionUser.email } : null
}

function readDemoUser(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(DEMO_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

async function approvedUserFromSession(
  session: { user?: { id: string; email?: string | null } } | null,
): Promise<{ user: AuthUser | null; pending?: boolean; rejected?: boolean }> {
  const next = userFromSession(session)
  if (!next) return { user: null }
  let status: Awaited<ReturnType<typeof readOwnApproval>> = null
  try {
    status = await readOwnApproval(next.id, next.email)
  } catch {
    if (supabase) await supabase.auth.signOut()
    sessionStorage.removeItem(DEMO_KEY)
    return { user: null, pending: true }
  }
  if (status === 'approved') return { user: next }
  if (supabase) await supabase.auth.signOut()
  sessionStorage.removeItem(DEMO_KEY)
  if (status === 'rejected') return { user: null, rejected: true }
  return { user: null, pending: true }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const mode = hasSupabaseConfig ? 'supabase' : 'demo'

  useEffect(() => {
    if (!supabase) {
      setUser(readDemoUser())
      setLoading(false)
      return
    }

    let cancelled = false

    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      const result = await approvedUserFromSession(data.session)
      if (cancelled) return
      setUser((prev) => (sameAuthUser(prev, result.user) ? prev : result.user))
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') {
        setRecovery(false)
        setUser(null)
        return
      }
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true)
        setUser(userFromSession(session))
        return
      }
      void approvedUserFromSession(session).then((result) => {
        if (cancelled) return
        setUser((prev) => (sameAuthUser(prev, result.user) ? prev : result.user))
      })
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      mode,
      recovery,
      async signIn(email, password) {
        const trimmed = email.trim().toLowerCase()
        if (!trimmed || !password) {
          return { error: 'Enter email and password.' }
        }
        if (password.length < 6) {
          return { error: 'Password must be at least 6 characters.' }
        }

        if (!supabase) {
          const account = findDemoAccount(trimmed)
          if (!account) return { error: approvalMessage(undefined) }
          if (account.approval_status === 'pending') return { pending: true }
          if (account.approval_status !== 'approved') {
            return { error: approvalMessage(account.approval_status) }
          }
          const demoUser = { id: account.id, email: account.email }
          sessionStorage.setItem(DEMO_KEY, JSON.stringify(demoUser))
          setUser(demoUser)
          return {}
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmed,
          password,
        })
        if (error) return { error: error.message }
        const result = await approvedUserFromSession(data.session)
        if (result.pending) return { pending: true }
        if (result.rejected) return { error: approvalMessage('rejected') }
        if (!result.user) return { pending: true }
        return {}
      },
      async signUp(email, password) {
        const trimmed = email.trim().toLowerCase()
        if (!trimmed || !password) {
          return { error: 'Enter email and password.' }
        }
        if (password.length < 6) {
          return { error: 'Password must be at least 6 characters.' }
        }

        if (!supabase) {
          const existing = findDemoAccount(trimmed)
          if (existing?.approval_status === 'approved') {
            return { error: 'That email already has an account. Sign in instead.' }
          }
          if (existing?.approval_status === 'rejected') {
            return { error: approvalMessage('rejected') }
          }
          const account = registerDemoSignup(trimmed)
          if (account.approval_status === 'pending') {
            return { pending: true }
          }
          return {}
        }

        const { data, error } = await supabase.auth.signUp({
          email: trimmed,
          password,
        })
        if (error) return { error: error.message }
        const userId = data.user?.id
        if (userId) {
          const status = await readOwnApproval(userId, trimmed)
          if (status === 'pending' || status === 'rejected' || !status) {
            if (data.session) await supabase.auth.signOut()
            setUser(null)
            return status === 'rejected'
              ? { error: approvalMessage('rejected') }
              : { pending: true }
          }
        } else if (!data.session) {
          return { pending: true }
        }
        return {}
      },
      async requestPasswordReset(email) {
        const trimmed = email.trim().toLowerCase()
        if (!trimmed) return { error: 'Enter your email.' }
        if (!supabase) {
          return { error: 'Password reset is not available in demo. Use a demo email on the sign-in page.' }
        }
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) return { error: error.message }
        return {}
      },
      async updatePassword(password) {
        if (password.length < 6) {
          return { error: 'Password must be at least 6 characters.' }
        }
        if (!supabase) {
          return { error: 'Password reset is not available in demo.' }
        }
        const { error } = await supabase.auth.updateUser({ password })
        if (error) return { error: error.message }
        setRecovery(false)
        const { data } = await supabase.auth.getSession()
        const result = await approvedUserFromSession(data.session)
        if (result.pending) return { pending: true }
        if (result.rejected) return { error: approvalMessage('rejected') }
        setUser((prev) => (sameAuthUser(prev, result.user) ? prev : result.user))
        return {}
      },
      async signOut() {
        if (supabase) {
          await supabase.auth.signOut()
        }
        sessionStorage.removeItem(DEMO_KEY)
        setRecovery(false)
        setUser(null)
      },
    }),
    [loading, mode, recovery, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
