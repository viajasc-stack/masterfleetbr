import { getPublicMediaUrl, supabase } from '../lib/supabase'
import type { MessageAudience, Profile, ProfileType } from '../types'

export interface ProfileUpdateInput {
  username?: string
  displayName?: string
  bio?: string
  avatarUrl?: string
  coverUrl?: string
  profileType?: ProfileType
  identityLabel?: string
  city?: string
  state?: string
  interests?: string[]
  birthDate?: string
  isPrivate?: boolean
  searchVisible?: boolean
  showCity?: boolean
  showOnlineStatus?: boolean
  allowMessagesFrom?: MessageAudience
  invisibleMode?: boolean
}

export const updateMyProfile = async (input: ProfileUpdateInput) => {
  const { data, error } = await supabase.rpc('update_my_profile', {
    p_username: input.username,
    p_display_name: input.displayName,
    p_bio: input.bio,
    p_avatar_url: input.avatarUrl,
    p_cover_url: input.coverUrl,
    p_profile_type: input.profileType,
    p_identity_label: input.identityLabel,
    p_city: input.city,
    p_state: input.state,
    p_interests: input.interests,
    p_birth_date: input.birthDate,
    p_is_private: input.isPrivate,
    p_search_visible: input.searchVisible,
    p_show_city: input.showCity,
    p_show_online_status: input.showOnlineStatus,
    p_allow_messages_from: input.allowMessagesFrom,
    p_invisible_mode: input.invisibleMode,
  })

  if (error) throw error
  return data as Profile
}

export const uploadProfileImage = async (bucket: 'avatars' | 'covers', userId: string, file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${bucket}-${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
  })
  if (error) throw error
  return getPublicMediaUrl(bucket, path)
}