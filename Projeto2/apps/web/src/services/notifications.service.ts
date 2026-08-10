import { supabase } from '../lib/supabase'
import type { LovixNotification } from '../types'

export const getNotifications = async () => {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, recipient_id, actor_id, type, post_id, is_read, created_at, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return (data ?? []).map(notification => ({
    ...notification,
    actor: Array.isArray(notification.actor) ? notification.actor[0] : notification.actor,
  })) as LovixNotification[]
}

export const markNotificationsRead = async (ids: string[]) => {
  if (ids.length === 0) return
  const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids)
  if (error) throw error
}