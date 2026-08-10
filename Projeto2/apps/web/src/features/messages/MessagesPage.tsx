import { ArrowLeft, Crown, MessageCircle, Send } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { LovixAppContext } from '../../app-context'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { formatRelativeDate } from '../../lib/format'
import { getMessages, getMyConversations, sendMessage } from '../../services/messages.service'
import { supabase } from '../../lib/supabase'
import { PUBLIC_PROFILE_SELECT } from '../../services/social.service'
import type { ConversationPreview, DirectMessage, Profile } from '../../types'

export function MessagesPage() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useOutletContext<LovixAppContext>()
  const [conversations, setConversations] = useState<ConversationPreview[]>([])
  const [contacts, setContacts] = useState<Record<string, Profile>>({})
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!profile.is_premium) { setLoading(false); return }
      try {
        const list = await getMyConversations(user.id)
        setConversations(list)
        const ids = [...new Set(list.map(item => item.member_low_id === user.id ? item.member_high_id : item.member_low_id))]
        if (ids.length) {
          const { data, error } = await supabase.from('profiles').select(PUBLIC_PROFILE_SELECT).in('id', ids)
          if (error) throw error
          setContacts(Object.fromEntries((data ?? []).map(item => [item.id, item as Profile])))
        }
        if (conversationId) setMessages(await getMessages(conversationId))
      } catch (error) {
        console.error(error)
        toast.error('Não foi possível carregar as mensagens.')
      } finally { setLoading(false) }
    }
    void load()
  }, [conversationId, profile.is_premium, user.id])

  const selected = conversations.find(item => item.id === conversationId)
  const otherId = selected ? (selected.member_low_id === user.id ? selected.member_high_id : selected.member_low_id) : ''
  const recipient = otherId ? contacts[otherId] : undefined

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!conversationId || !draft.trim()) return
    try {
      await sendMessage(conversationId, user.id, draft)
      setDraft('')
      setMessages(await getMessages(conversationId))
    } catch { toast.error('Não foi possível enviar a mensagem.') }
  }

  if (!profile.is_premium) return <div className="page"><section className="message-lock"><span><Crown size={30} /></span><h1>Mensagens são Premium</h1><p>Assine para iniciar conversas privadas com outros perfis da comunidade.</p><Link to="/premium" className="button button--primary">Conhecer Premium</Link></section></div>

  return <div className="page page--messages">
    <section className={`conversation-list ${conversationId ? 'conversation-list--mobile-hidden' : ''}`}><header><span className="eyebrow">MENSAGENS</span><h1>Conversas</h1></header>{loading ? <div className="conversation-loading" /> : conversations.length === 0 ? <EmptyState icon={MessageCircle} title="Nenhuma conversa ainda" description="Abra um perfil e toque em Mensagem para iniciar uma conexão." /> : <div>{conversations.map(conversation => { const contactId = conversation.member_low_id === user.id ? conversation.member_high_id : conversation.member_low_id; const contact = contacts[contactId]; return <Link key={conversation.id} to={`/messages/${conversation.id}`} className={`conversation-item ${conversationId === conversation.id ? 'is-active' : ''}`}><Avatar name={contact?.display_name || 'Membro'} src={contact?.avatar_url} /><span><strong>{contact?.display_name || 'Membro LOVIX'}</strong><small>@{contact?.username ?? 'perfil'}</small></span>{conversation.last_message_at && <time>{formatRelativeDate(conversation.last_message_at)}</time>}</Link> })}</div>}</section>
    <section className={`message-thread ${conversationId ? '' : 'message-thread--empty'}`}>{conversationId && selected ? <><header><button className="icon-button message-thread__back" onClick={() => navigate('/messages')}><ArrowLeft size={20} /></button><Avatar name={recipient?.display_name || 'Membro'} src={recipient?.avatar_url} size="sm" /><span><strong>{recipient?.display_name || 'Membro LOVIX'}</strong><small>@{recipient?.username}</small></span></header><div className="message-thread__messages">{messages.map(message => <p key={message.id} className={message.sender_id === user.id ? 'message-bubble message-bubble--mine' : 'message-bubble'}>{message.body}<small>{formatRelativeDate(message.created_at)}</small></p>)}</div><form className="message-composer" onSubmit={submit}><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} placeholder="Escreva uma mensagem..." /><button className="icon-button icon-button--filled" disabled={!draft.trim()}><Send size={18} /></button></form></> : <EmptyState icon={MessageCircle} title="Selecione uma conversa" description="Suas conversas privadas aparecem aqui." />}</section>
  </div>
}