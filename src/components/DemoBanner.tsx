import { useAuth } from '@/lib/auth'

export function DemoBanner() {
  const { mode } = useAuth()
  if (mode !== 'demo') return null

  return (
    <p className="border-b border-line bg-surface px-4 py-2 text-center text-[12px] text-muted">
      Demo mode — RLS is simulated locally. Add Supabase keys to use the real
      database.
    </p>
  )
}
