import { Bell, CheckCheck, Heart, MessageCircle, MessageSquare, Shield, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { EmptyState } from '../../components/EmptyState'
import { Avatar } from '../../components/Avatar'
import { formatRelativeDate } from '../../lib/format'
import { getNotifications, markNotificationsRead } from '../../services/notifications.service'
import type { LovixNotification, NotificationType } from '../../types'

const iconByType: Record<NotificationType, typeof Bell> = {
  follow: UserPlus,
  like: Heart,
  comment: MessageSquare,
  message: MessageCircle,
  system: Shield,
}

const describeNotification = (notification: LovixNotification) => {
  const actorName = notification.actor?.display_name || notification.actor?.username || 'LOVIX'
  switch (notification.type) {
    case 'follow': return `${actorName} começou a seguir você.`
    case 'like': return `${actorName} curtiu sua publicação.`
    case 'comment': return `${actorName} comentou em sua publicação.`
    case 'message': return `${actorName} enviou uma mensagem.`
    case 'system': return 'Atualização importante da plataforma.'
  }
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<LovixNotification[]>([])
  const [loading, setLoading] = useState(true)
  const unreadIds = useMemo(() => notifications.filter(item => !item.is_read).map(item => item.id), [notifications])

  useEffect(() => {
    let active = true
    getNotifications()
      .then(data => { if (active) setNotifications(data) })
      .catch(() => toast.error('Não foi possível carregar notificações.'))
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const markAllRead = async () => {
    try {
      await markNotificationsRead(unreadIds)
      setNotifications(current => current.map(item => ({ ...item, is_read: true })))
      toast.success('Notificações marcadas como lidas.')
    } catch {
      toast.error('Não foi possível atualizar notificações.')
    }
  }

  return (
    <div className="page page--form">
      <header className="page-header">
        <div>
          <span className="eyebrow">CENTRAL DE ATUALIZAÇÕES</span>
          <h1>Notificações</h1>
          <p>Acompanhe interações, mensagens e avisos importantes da sua comunidade.</p>
        </div>
        <button className="button button--secondary" onClick={markAllRead} disabled={unreadIds.length === 0}>
          <CheckCheck size={17} /> Marcar lidas
        </button>
      </header>

      {loading ? <div className="settings-form notification-list"><div className="profile-skeleton" /></div> : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="Nada por aqui ainda" description="Quando alguém interagir com você, suas atualizações aparecerão nesta central." />
      ) : (
        <section className="settings-form notification-list" aria-label="Lista de notificações">
          {notifications.map(notification => {
            const Icon = iconByType[notification.type]
            return (
              <article key={notification.id} className={`notification-item ${notification.is_read ? '' : 'is-unread'}`}>
                {notification.actor ? <Avatar name={notification.actor.display_name || notification.actor.username} src={notification.actor.avatar_url} /> : <span className="notification-item__icon"><Icon size={18} /></span>}
                <div>
                  <strong>{describeNotification(notification)}</strong>
                  <small>{formatRelativeDate(notification.created_at)}</small>
                </div>
                {!notification.is_read && <span className="notification-item__dot" aria-label="Não lida" />}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}