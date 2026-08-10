import { Camera, Edit3, Grid2X2, MapPin, MessageCircle, Settings2, UserPlus, UsersRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { LovixAppContext } from '../../app-context'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { StatusBadge } from '../../components/StatusBadge'
import { getOrCreateConversation } from '../../services/messages.service'
import { updateMyProfile, uploadProfileImage } from '../../services/profile.service'
import { getPostsByAuthor, getProfileByUsername, getProfileCounters, isFollowing, toggleFollow } from '../../services/social.service'
import type { FeedPost, Profile } from '../../types'

interface ProfilePageProps {
  onProfileUpdated: () => Promise<void>
}

export function ProfilePage({ onProfileUpdated }: ProfilePageProps) {
  const { username } = useParams()
  const navigate = useNavigate()
  const context = useOutletContext<LovixAppContext>()
  const isOwn = !username || username.toLowerCase() === context.profile.username.toLowerCase()
  const [viewedProfile, setViewedProfile] = useState<Profile | null>(isOwn ? context.profile : null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [counts, setCounts] = useState({ posts: 0, followers: 0, following: 0 })
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const avatarInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const found = isOwn ? context.profile : await getProfileByUsername(username ?? '')
        if (!found) {
          setViewedProfile(null)
          return
        }
        setViewedProfile(found)
        const [postList, counters, relationship] = await Promise.all([
          getPostsByAuthor(found.id),
          getProfileCounters(found.id),
          isOwn ? Promise.resolve(false) : isFollowing(context.user.id, found.id),
        ])
        setPosts(postList)
        setCounts(counters)
        setFollowing(relationship)
      } catch (error) {
        console.error(error)
        toast.error('Não foi possível carregar este perfil.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [context.profile, context.user.id, isOwn, username])

  const uploadImage = async (kind: 'avatars' | 'covers', file?: File) => {
    if (!file) return
    try {
      const url = await uploadProfileImage(kind, context.user.id, file)
      await updateMyProfile(kind === 'avatars' ? { avatarUrl: url } : { coverUrl: url })
      await onProfileUpdated()
      toast.success(kind === 'avatars' ? 'Foto de perfil atualizada.' : 'Capa atualizada.')
    } catch {
      toast.error('Não foi possível enviar a imagem.')
    }
  }

  const follow = async () => {
    if (!viewedProfile) return
    try {
      const next = await toggleFollow(context.user.id, viewedProfile.id, following)
      setFollowing(next)
      setCounts(current => ({ ...current, followers: Math.max(0, current.followers + (next ? 1 : -1)) }))
    } catch {
      toast.error('Não foi possível atualizar essa conexão.')
    }
  }

  const openConversation = async () => {
    if (!viewedProfile) return
    if (!context.profile.is_premium) {
      toast('Mensagens privadas são um recurso Premium.')
      navigate('/premium')
      return
    }
    try {
      const conversation = await getOrCreateConversation(context.user.id, viewedProfile.id)
      navigate(`/messages/${conversation.id}`)
    } catch {
      toast.error('Não foi possível abrir a conversa.')
    }
  }

  if (loading) return <div className="page"><div className="profile-skeleton" /></div>
  if (!viewedProfile) return <div className="page"><EmptyState icon={UsersRound} title="Perfil indisponível" description="Este perfil não existe, está privado ou não está disponível." action={<Link className="button button--primary" to="/explore">Explorar pessoas</Link>} /></div>

  return (
    <div className="page page--profile">
      <section className="profile-hero">
        <div className="profile-hero__cover" style={viewedProfile.cover_url ? { backgroundImage: `url(${viewedProfile.cover_url})` } : undefined}>
          {isOwn && <button className="cover-edit" onClick={() => coverInput.current?.click()}><Camera size={16} /> Alterar capa</button>}
          <input ref={coverInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void uploadImage('covers', event.target.files?.[0])} />
        </div>
        <div className="profile-hero__content">
          <div className="profile-avatar-wrap"><Avatar name={viewedProfile.display_name || viewedProfile.username} src={viewedProfile.avatar_url} size="xl" />{isOwn && <button className="avatar-edit" onClick={() => avatarInput.current?.click()} aria-label="Alterar foto"><Camera size={15} /></button>}<input ref={avatarInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void uploadImage('avatars', event.target.files?.[0])} /></div>
          <div className="profile-hero__main"><div className="profile-hero__name"><h1>{viewedProfile.display_name || viewedProfile.username}</h1><StatusBadge real={viewedProfile.is_real} premium={viewedProfile.is_premium} /></div><p>@{viewedProfile.username} · {viewedProfile.profile_type === 'couple' ? 'Perfil de casal' : 'Perfil individual'}</p>{viewedProfile.show_city && viewedProfile.city && <small><MapPin size={15} /> {viewedProfile.city}{viewedProfile.state ? `, ${viewedProfile.state}` : ''}</small>}</div>
          <div className="profile-hero__actions">{isOwn ? <><Link className="button button--secondary" to="/profile/edit"><Edit3 size={16} /> Editar perfil</Link><Link className="icon-button" to="/settings" aria-label="Configurações"><Settings2 size={19} /></Link></> : <><button className={`button ${following ? 'button--secondary' : 'button--primary'}`} onClick={follow}><UserPlus size={17} /> {following ? 'Seguindo' : 'Seguir'}</button><button className="button button--secondary" onClick={() => void openConversation()}><MessageCircle size={17} /> Mensagem</button></>}</div>
        </div>
      </section>
      <section className="profile-body">
        <div className="profile-summary"><p>{viewedProfile.bio || 'Este membro ainda não adicionou uma bio.'}</p><div className="profile-interests">{viewedProfile.interests.map(interest => <span key={interest}>{interest}</span>)}</div></div>
        <div className="profile-stats"><span><strong>{counts.posts}</strong> publicações</span><span><strong>{counts.followers}</strong> seguidores</span><span><strong>{counts.following}</strong> seguindo</span></div>
        <div className="section-label"><Grid2X2 size={17} /><span>Publicações</span></div>
        {posts.length === 0 ? <EmptyState icon={Grid2X2} title={isOwn ? 'Seu mural está vazio' : 'Ainda não há publicações'} description={isOwn ? 'Compartilhe seu primeiro momento com a comunidade.' : 'Quando este perfil compartilhar algo, aparecerá aqui.'} action={isOwn ? <Link className="button button--primary" to="/create">Criar publicação</Link> : undefined} /> : <section className="post-grid">{posts.map(post => <article key={post.id} className="post-grid__item">{post.media[0]?.mediaType === 'video' ? <video src={post.media[0].storagePath} /> : post.media[0] ? <img src={post.media[0].storagePath} alt={post.caption || 'Publicação'} /> : null}<span>{post.likes_count} curtidas</span></article>)}</section>}
      </section>
    </div>
  )
}