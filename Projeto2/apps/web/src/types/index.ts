export type ProfileType = 'single' | 'couple'
export type ContentPrivacy = 'public' | 'followers' | 'following' | 'private'
export type MessageAudience = 'everyone' | 'premium' | 'followers' | 'none'
export type VerificationType = 'real_profile' | 'identity' | 'age_18'
export type VerificationStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'expired'

export interface Profile {
  id: string
  username: string
  display_name: string
  bio: string
  avatar_url: string | null
  cover_url: string | null
  profile_type: ProfileType
  identity_label: string
  city: string | null
  state: string | null
  interests: string[]
  birth_date: string | null
  is_profile_complete: boolean
  is_private: boolean
  search_visible: boolean
  show_city: boolean
  show_online_status: boolean
  allow_messages_from: MessageAudience
  invisible_mode: boolean
  is_online: boolean
  last_seen_at: string | null
  is_real: boolean
  is_verified: boolean
  is_premium: boolean
  premium_until: string | null
  subscription_status: 'free' | 'pending' | 'active' | 'expired' | 'cancelled'
  is_admin: boolean
  accepted_terms_at: string | null
  age_confirmed_at: string | null
  age_verified_at?: string | null
  identity_verified_at?: string | null
  moderation_status: 'active' | 'review' | 'suspended' | 'banned'
  created_at: string
  updated_at: string
}

export interface VerificationRequest {
  id: string
  user_id: string
  type: VerificationType
  status: VerificationStatus
  evidence_mime_type: string | null
  evidence_expires_at: string
  rejection_reason_public: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface PostMedia {
  id: string
  storagePath: string
  mediaType: 'image' | 'video'
  position: number
  altText: string
  aspectRatio: number | null
}

export interface FeedAuthor {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isReal: boolean
  isPremium: boolean
}

export interface FeedPost {
  id: string
  author_id: string
  caption: string
  location_name: string | null
  privacy: ContentPrivacy
  comments_enabled: boolean
  likes_count: number
  comments_count: number
  created_at: string
  updated_at: string
  author: FeedAuthor
  media: PostMedia[]
  likedByMe?: boolean
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  body: string
  created_at: string
  author?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'>
}

export interface SubscriptionPlan {
  id: string
  code: string
  name: string
  description: string
  price_cents: number
  duration_days: number
  is_active: boolean
}

export interface ConversationPreview {
  id: string
  member_low_id: string
  member_high_id: string
  last_message_at: string | null
  updated_at: string
}

export interface DirectMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
}

export type NotificationType = 'follow' | 'like' | 'comment' | 'message' | 'system'

export interface LovixNotification {
  id: string
  recipient_id: string
  actor_id: string | null
  type: NotificationType
  post_id: string | null
  is_read: boolean
  created_at: string
  actor?: Pick<Profile, 'username' | 'display_name' | 'avatar_url'> | null
}

export interface AdminDashboardMetrics {
  usersTotal: number
  usersActive: number
  usersSuspended: number
  usersBanned: number
  premiumActive: number
  postsTotal: number
  postsReview: number
  postsRemoved: number
  reportsOpen: number
}

export interface AdminSaasMetrics {
  users7d: number
  users30d: number
  posts7d: number
  premiumConversionPct: number
  approvedVerificationRatePct: number
  avgVerificationHours: number
  estimatedMrrCents: number
  reportReasons: Record<string, number>
}

export interface AdminProfile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  city: string | null
  state: string | null
  is_admin: boolean
  is_real: boolean
  is_verified: boolean
  is_premium: boolean
  premium_until: string | null
  subscription_status: string
  moderation_status: string
  banned_at: string | null
  ban_reason: string | null
  created_at: string
}

export interface AdminReport {
  id: string
  reporter_id: string
  reporter_username: string | null
  reported_user_id: string | null
  reported_username: string | null
  post_id: string | null
  reason: string
  details: string
  status: string
  created_at: string
}

export interface AdminPost {
  id: string
  author_id: string
  author_username: string
  author_display_name: string
  caption: string
  privacy: ContentPrivacy
  moderation_status: string
  likes_count: number
  comments_count: number
  media_count: number
  created_at: string
}

export interface AdminAuditLog {
  id: string
  admin_id: string | null
  admin_username: string | null
  action: string
  target_type: string
  target_id: string
  reason: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AdminVerificationRequest {
  id: string
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  type: VerificationType
  status: VerificationStatus
  evidence_path: string | null
  evidence_mime_type: string | null
  evidence_expires_at: string
  review_notes_private: string | null
  rejection_reason_public: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface AdminSetting {
  key: string
  value: Record<string, unknown>
  updated_by: string | null
  updated_by_username: string | null
  updated_at: string
}

export interface AdminRole {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  role: 'owner' | 'admin' | 'moderator' | 'support'
  permissions: Record<string, unknown>
  assigned_by: string | null
  created_at: string
  updated_at: string
}

export type AdminDetailPayload = Record<string, unknown>

export type RuntimeSettings = Record<string, Record<string, unknown>>