import { supabase } from '../lib/supabase'
import type { ConversationPreview, DirectMessage } from '../types'

export const getMyConversations = async (userId: string) => {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .or(`member_low_id.eq.${userId},member_high_id.eq.${userId}`)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw error
  return (data ?? []) as ConversationPreview[]
}

export const getOrCreateConversation = async (firstUserId: string, secondUserId: string) => {
  const [memberLowId, memberHighId] = [firstUserId, secondUserId].sort()
  const { data: existing, error: existingError } = await supabase
    .from('conversations')
    .select('*')
    .eq('member_low_id', memberLowId)
    .eq('member_high_id', memberHighId)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) return existing as ConversationPreview

  const { data, error } = await supabase
    .from('conversations')
    .insert({ member_low_id: memberLowId, member_high_id: memberHighId })
    .select('*')
    .single()
  if (error) throw error
  return data as ConversationPreview
}

export const getMessages = async (conversationId: string) => {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw error
  return (data ?? []) as DirectMessage[]
}

export const sendMessage = async (conversationId: string, senderId: string, body: string) => {
  const { error } = await supabase.from('direct_messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    body: body.trim(),
  })
  if (error) throw error
}