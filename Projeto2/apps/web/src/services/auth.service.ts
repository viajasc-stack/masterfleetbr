import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export const getMyProfile = async (userId: string) => {
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) throw error
  if (!data || data.id !== userId) throw new Error('Perfil autenticado não encontrado.')
  return data as Profile
}

export const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export const signUp = async (input: { email: string; password: string; displayName: string }) => {
  const now = new Date().toISOString()
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/onboarding`,
      data: {
        display_name: input.displayName.trim(),
        accepted_terms_at: now,
        age_confirmed_at: now,
        accepted_terms_version: '2026-08',
      },
    },
  })
  if (error) throw error
  return data
}

export const signOut = () => supabase.auth.signOut()

export const getInitialSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}