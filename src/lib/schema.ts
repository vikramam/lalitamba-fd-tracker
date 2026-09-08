import { supabase } from '@/lib/supabase'

export async function isDatabaseReady(): Promise<{ ready: boolean; message?: string }> {
  if (!supabase) {
    return { ready: false, message: 'demo' }
  }

  const { error } = await supabase.from('profiles').select('id').limit(1)
  if (!error) return { ready: true }

  if (error.code === 'PGRST205' || error.message.includes('profiles')) {
    return {
      ready: false,
      message:
        'Supabase is connected, but the tables are not there yet. In the Supabase SQL editor, run supabase/APPLY_ALL.sql once.',
    }
  }

  return { ready: false, message: error.message }
}
