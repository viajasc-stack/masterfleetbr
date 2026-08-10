/**
 * Contratos sem dependência de browser, React ou Supabase.
 * Web e o futuro app Expo podem importar este pacote sem acoplamento de UI.
 */
export type LovixProfileType = 'single' | 'couple'
export type LovixMessageAudience = 'everyone' | 'premium' | 'followers' | 'none'
export type LovixContentPrivacy = 'public' | 'followers' | 'private'

export interface LovixProfileSummary {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isReal: boolean
  isPremium: boolean
}

export const LOVIX_MINIMUM_AGE = 18
export const LOVIX_TERMS_VERSION = '2026-08'

export const isAdultBirthDate = (birthDate: string, referenceDate = new Date()) => {
  const date = new Date(`${birthDate}T12:00:00`)
  if (Number.isNaN(date.getTime())) return false

  const threshold = new Date(referenceDate)
  threshold.setFullYear(threshold.getFullYear() - LOVIX_MINIMUM_AGE)
  return date <= threshold
}