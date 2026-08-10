import type { User } from '@supabase/supabase-js'
import type { Profile } from './types'

export interface LovixAppContext {
  user: User
  profile: Profile
  refreshProfile: () => Promise<void>
}