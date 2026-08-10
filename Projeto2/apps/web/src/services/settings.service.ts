import { supabase } from '../lib/supabase'
import type { RuntimeSettings } from '../types'

export const getRuntimeSettings = async (keys: string[] = ['content', 'premium', 'verification', 'registration']) => {
  const { data, error } = await supabase.rpc('get_runtime_settings', { p_keys: keys })
  if (error) throw error
  return Object.fromEntries(((data ?? []) as Array<{ key: string; value: Record<string, unknown> }>).map(item => [item.key, item.value])) as RuntimeSettings
}