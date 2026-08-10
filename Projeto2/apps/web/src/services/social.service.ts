import { getPublicMediaUrl, supabase } from '../lib/supabase'
import type { Comment, ContentPrivacy, FeedPost, Profile } from '../types'

export const PUBLIC_PROFILE_SELECT = 'id, username, display_name, bio, avatar_url, cover_url, profile_type, identity_label, city, state, interests, is_private, search_visible, show_city, show_online_status, is_real, is_verified, is_premium, moderation_status, created_at, updated_at'

const mapFeedPost = (post: FeedPost): FeedPost => ({
  ...post,
  media: (post.media ?? []).map(media => ({
    ...media,
    storagePath: getPublicMediaUrl('posts', media.storagePath),
  })),
})

export const getFeed = async (userId: string) => {
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw error

  const rawPosts = (data ?? []) as FeedPost[]
  if (rawPosts.length === 0) return []

  const { data: likes, error: likesError } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', rawPosts.map(post => post.id))

  if (likesError) throw likesError
  const likedPostIds = new Set((likes ?? []).map(like => like.post_id as string))

  return rawPosts.map(post => ({ ...mapFeedPost(post), likedByMe: likedPostIds.has(post.id) }))
}

export const toggleLike = async (postId: string, userId: string, isLiked: boolean) => {
  if (isLiked) {
    const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId)
    if (error) throw error
    return false
  }

  const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: userId })
  if (error) throw error
  return true
}

export const getComments = async (postId: string) => {
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, author_id, body, created_at, author:profiles!comments_author_id_fkey(username, display_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) throw error

  return (data ?? []).map(comment => {
    const rawAuthor = Array.isArray(comment.author) ? comment.author[0] : comment.author
    return { ...comment, author: rawAuthor } as Comment
  })
}

export const createComment = async (postId: string, authorId: string, body: string) => {
  const { error } = await supabase.from('comments').insert({ post_id: postId, author_id: authorId, body: body.trim() })
  if (error) throw error
}

export const uploadPostAndCreate = async (input: {
  authorId: string
  file: File
  caption: string
  locationName: string
  privacy: ContentPrivacy
}) => {
  const extension = input.file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const mediaType = input.file.type.startsWith('video/') ? 'video' : 'image'
  const storagePath = `${input.authorId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage.from('posts').upload(storagePath, input.file, {
    cacheControl: '31536000',
    contentType: input.file.type,
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      author_id: input.authorId,
      caption: input.caption.trim(),
      location_name: input.locationName.trim() || null,
      privacy: input.privacy,
    })
    .select('id')
    .single()

  if (postError) {
    await supabase.storage.from('posts').remove([storagePath])
    throw postError
  }

  const { error: mediaError } = await supabase.from('post_media').insert({
    post_id: post.id,
    storage_path: storagePath,
    media_type: mediaType,
    position: 0,
  })

  if (mediaError) throw mediaError
}

export const searchProfiles = async (query: string) => {
  let request = supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .eq('search_visible', true)
    .eq('moderation_status', 'active')
    .order('is_premium', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30)

  if (query.trim()) {
    const safeQuery = query.trim().replace(/[%_,()]/g, '')
    request = request.or(`username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%,city.ilike.%${safeQuery}%`)
  }

  const { data, error } = await request
  if (error) throw error
  return (data ?? []) as Profile[]
}

export const getProfileByUsername = async (username: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_SELECT)
    .ilike('username', username)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}

export const getPostsByAuthor = async (authorId: string) => {
  const { data, error } = await supabase
    .from('feed_posts')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) throw error
  return ((data ?? []) as FeedPost[]).map(mapFeedPost)
}

export const getProfileCounters = async (profileId: string) => {
  const [posts, followers, following] = await Promise.all([
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', profileId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profileId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profileId),
  ])

  if (posts.error) throw posts.error
  if (followers.error) throw followers.error
  if (following.error) throw following.error
  return { posts: posts.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 }
}

export const isFollowing = async (followerId: string, followingId: string) => {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export const getFollowingIds = async (followerId: string, targetProfileIds: string[]) => {
  if (targetProfileIds.length === 0) return new Set<string>()

  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', followerId)
    .in('following_id', targetProfileIds)

  if (error) throw error
  return new Set((data ?? []).map(follow => follow.following_id as string))
}

export const toggleFollow = async (followerId: string, followingId: string, following: boolean) => {
  if (following) {
    const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId)
    if (error) throw error
    return false
  }
  const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
  if (error) throw error
  return true
}