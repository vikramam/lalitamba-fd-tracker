import { useEffect, useState } from 'react'

import { hasSupabaseConfig } from '@/lib/supabase'
import { isDatabaseReady } from '@/lib/schema'

export function SetupBanner() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!hasSupabaseConfig) return
    void isDatabaseReady().then((result) => {
      if (!result.ready && result.message && result.message !== 'demo') {
        setMessage(result.message)
      }
    })
  }, [])

  if (!hasSupabaseConfig) return null
  if (!message) return null

  return (
    <p
      className="type-small border-b border-line px-4 py-3 text-center leading-relaxed text-warn"
      style={{ background: 'rgba(217,130,43,0.14)' }}
    >
      {message}
    </p>
  )
}
