import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DemoBanner } from '@/components/DemoBanner'
import { SetupBanner } from '@/components/SetupBanner'
import { ShimmerAuth } from '@/components/Shimmer'
import { useDialog } from '@/hooks/DialogProvider'
import { useAuth } from '@/lib/auth'

export function ResetPasswordPage() {
  const { loading, recovery, updatePassword } = useAuth()
  const { alert } = useDialog()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <ShimmerAuth />

  if (done && !pending) {
    return <Navigate to="/dashboard" replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(false)
    if (password !== confirm) {
      await alert('New password', 'Passwords do not match.')
      return
    }
    setSubmitting(true)
    const result = await updatePassword(password)
    setSubmitting(false)
    if (result.error) {
      await alert('New password', result.error)
      return
    }
    if (result.pending) {
      setPending(true)
      return
    }
    setDone(true)
  }

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <DemoBanner />
      <SetupBanner />
      <main className="page-enter mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
        <p className="type-login-title text-ink">
          New password
        </p>
        <p className="mt-2 type-body text-muted">
          {recovery
            ? 'Choose a new password for your account.'
            : 'This reset link is missing or has expired. Request a new one.'}
        </p>

        {recovery ? (
          <form className="hero-card mt-8 space-y-5 p-5" onSubmit={(event) => void onSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={6}
              />
            </div>

            {pending ? (
              <p className="type-body text-warn" role="status">
                Password updated. Your account is still pending approval, so you cannot sign in yet.
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save password'}
            </Button>
          </form>
        ) : (
          <div className="hero-card mt-8 p-5">
            <Link to="/forgot-password" className="type-body text-accent">
              Request a new reset link
            </Link>
          </div>
        )}

        <Link to="/login" className="mt-8 type-body text-accent">
          Back to sign in
        </Link>
      </main>
    </div>
  )
}
