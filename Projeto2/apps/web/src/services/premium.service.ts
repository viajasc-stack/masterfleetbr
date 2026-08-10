import { supabase } from '../lib/supabase'
import type { SubscriptionPlan } from '../types'

export const getActivePremiumPlan = async () => {
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, code, name, description, price_cents, duration_days, is_active')
    .eq('is_active', true)
    .order('price_cents')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data as SubscriptionPlan | null
}