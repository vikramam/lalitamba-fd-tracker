import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'

import { AppLogo } from '@/components/AppLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DemoBanner } from '@/components/DemoBanner'
import { SetupBanner } from '@/components/SetupBanner'
import { ShimmerAuth } from '@/components/Shimmer'
import { useAuth } from '@/lib/auth'

export function LoginPage() {
  const { user, loading, mode, recovery, signIn, signUp } = useAuth()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [pending, setPending] = useState<'in' | 'up' | null>(null)
  const [submitting, setSubmitting] = useState<'in' | 'up' | null>(null)

  if (loading) {
    return <ShimmerAuth />
  }

  if (recovery) {
    return <Navigate to="/reset-password" replace />
  }

  if (user) {
    return <Navigate to={from} replace />
  }

  async function authenticate(action: 'in' | 'up') {
    setError(null)
    setInfo(null)
    setPending(null)
    setSubmitting(action)
    const result =
      action === 'in' ? await signIn(email, password) : await signUp(email, password)
    setSubmitting(null)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.pending) {
      setPending(action)
      return
    }
    if (action === 'up' && mode === 'supabase') {
      setInfo('Check your email to confirm the account, then sign in after an admin approves you.')
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <DemoBanner />
      <SetupBanner />
      <main className="page-enter mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
        <AppLogo className="size-16" />
        <p className="mt-4 font-display text-[22px] font-bold tracking-tight text-ink">
          Lalitamba FD Gadag
        </p>
        <p className="mt-2 text-[13px] text-muted">
          Sign in to the family ledger. New accounts wait for admin approval.
        </p>

        <form
          className="hero-card mt-8 space-y-5 p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void authenticate('in')
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </div>

          {pending ? (
            <p className="text-[13px] text-warn" role="status">
              {pending === 'up'
                ? 'Account created. It is pending approval — an admin must approve it before you can sign in.'
                : 'Your account is pending approval. An admin must approve it before you can sign in.'}
            </p>
          ) : null}
          {error ? (
            <p className="text-[13px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          {info ? (
            <p className="text-[13px] text-success" role="status">
              {info}
            </p>
          ) : null}

          <div className="space-y-3 pt-1">
            <Link to="/forgot-password" className="block text-right text-[13px] text-accent">
              Forgot password?
            </Link>

            <Button type="submit" size="lg" disabled={submitting !== null}>
              {submitting === 'in' ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={submitting !== null}
              onClick={() => void authenticate('up')}
            >
              {submitting === 'up' ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </form>

        <p className="mt-8 text-[12px] leading-relaxed text-muted">
          Access is limited to your family. Admins see everything.
          {mode === 'demo' ? (
            <>
              {' '}
              Demo: vikram@family.test, other@family.test, or
              admin@family.test.
            </>
          ) : null}
        </p>
      </main>
    </div>
  )
}
