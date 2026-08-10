import { Heart, ImagePlus, MessageCircle, MoreHorizontal, RefreshCw, Send, Sparkles } from 'lucide-react'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { LovixAppContext } from '../../app-context'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { StatusBadge } from '../../components/StatusBadge'
import { formatRelativeDate } from '../../lib/format'
import { createComment, getComments, getFeed, toggleLike } from '../../services/social.service'
import type { Comment, FeedPost } from '../../types'

const storyColors = ['#de4d7a', '#bb547f', '#875ac8', '#e6814c', '#9b5694']

export function HomePage() {
  const { user, profile } = useOutletContext<LovixAppContext>()
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCommentsPost, setActiveCommentsPost] = useState<FeedPost | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)

  const loadFeed = async () => {
    setLoading(true)
    try {
      setPosts(await getFeed(user.id))
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível carregar o feed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    void getFeed(user.id)
      .then(nextPosts => {
        if (!cancelled) setPosts(nextPosts)
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) toast.error('Não foi possível carregar o feed.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user.id])

  const handleLike = async (post: FeedPost) => {
    const oldLiked = Boolean(post.likedByMe)
    setPosts(current => current.map(item => item.id === post.id ? {
      ...item,
      likedByMe: !oldLiked,
      likes_count: Math.max(0, item.likes_count + (oldLiked ? -1 : 1)),
    } : item))
    try {
      await toggleLike(post.id, user.id, oldLiked)
    } catch {
      setPosts(current => current.map(item => item.id === post.id ? {
        ...item,
        likedByMe: oldLiked,
        likes_count: Math.max(0, item.likes_count + (oldLiked ? 1 : -1)),
      } : item))
      toast.error('Não foi possível atualizar a curtida.')
    }
  }

  const openComments = async (post: FeedPost) => {
    setActiveCommentsPost(post)
    setComments([])
    try {
      setComments(await getComments(post.id))
    } catch {
      toast.error('Não foi possível carregar os comentários.')
    }
  }

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeCommentsPost || !commentText.trim()) return
    setCommentLoading(true)
    try {
      await createComment(activeCommentsPost.id, user.id, commentText)
      setCommentText('')
      setComments(await getComments(activeCommentsPost.id))
      setPosts(current => current.map(post => post.id === activeCommentsPost.id ? { ...post, comments_count: post.comments_count + 1 } : post))
    } catch {
      toast.error('Não foi possível publicar seu comentário.')
    } finally {
      setCommentLoading(false)
    }
  }

  return (
    <div className="page page--feed">
      <section className="feed-heading">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> seu espaço</span>
          <h1>Olá, {profile.display_name || profile.username}.</h1>
          <p>Descubra o que está acontecendo na sua comunidade.</p>
        </div>
        <button className="button button--secondary button--compact" onClick={() => void loadFeed()} disabled={loading}><RefreshCw size={16} className={loading ? 'spin' : ''} /> Atualizar</button>
      </section>

      <section className="story-rail" aria-label="Stories recentes">
        <Link to="/profile" className="story-avatar story-avatar--create">
          <span className="story-avatar__circle"><Avatar name={profile.display_name || profile.username} src={profile.avatar_url} size="lg" /></span>
          <span className="story-avatar__plus">+</span>
          <small>Seu story</small>
        </Link>
        {posts.slice(0, 7).map((post, index) => (
          <Link key={post.id} to={`/profile/${post.author.username}`} className="story-avatar">
            <span className="story-avatar__circle" style={{ '--story-color': storyColors[index % storyColors.length] } as CSSProperties}>
              <Avatar name={post.author.displayName || post.author.username} src={post.author.avatarUrl} size="lg" ring />
            </span>
            <small>{post.author.displayName || post.author.username}</small>
          </Link>
        ))}
      </section>

      <section className="quick-create">
        <Avatar name={profile.display_name || profile.username} src={profile.avatar_url} />
        <Link to="/create">Compartilhe algo com sua comunidade</Link>
        <Link to="/create" className="icon-button" aria-label="Criar publicação"><ImagePlus size={19} /></Link>
      </section>

      <section className="feed-list" aria-live="polite">
        {loading ? <FeedSkeleton /> : posts.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="O feed está começando"
            description="Seja a primeira pessoa a compartilhar algo com a comunidade."
            action={<Link className="button button--primary" to="/create">Criar publicação</Link>}
          />
        ) : posts.map(post => (
          <article className="post-card" key={post.id}>
            <header className="post-card__header">
              <Link to={`/profile/${post.author.username}`} className="post-author">
                <Avatar name={post.author.displayName || post.author.username} src={post.author.avatarUrl} ring />
                <span><strong>{post.author.displayName || post.author.username}</strong><small>@{post.author.username} · {formatRelativeDate(post.created_at)}</small></span>
                <StatusBadge real={post.author.isReal} premium={post.author.isPremium} />
              </Link>
              <button className="icon-button icon-button--ghost" aria-label="Mais opções"><MoreHorizontal size={21} /></button>
            </header>
            {post.media[0] && (
              post.media[0].mediaType === 'video'
                ? <video className="post-card__media" controls src={post.media[0].storagePath} />
                : <img className="post-card__media" src={post.media[0].storagePath} alt={post.media[0].altText || 'Publicação'} />
            )}
            <div className="post-card__body">
              <div className="post-card__actions">
                <button className={`action-button ${post.likedByMe ? 'is-liked' : ''}`} onClick={() => void handleLike(post)} aria-label={post.likedByMe ? 'Remover curtida' : 'Curtir'}><Heart size={22} fill={post.likedByMe ? 'currentColor' : 'none'} /></button>
                <button className="action-button" onClick={() => void openComments(post)} aria-label="Ver comentários"><MessageCircle size={21} /></button>
              </div>
              <strong className="post-card__likes">{post.likes_count} {post.likes_count === 1 ? 'curtida' : 'curtidas'}</strong>
              {post.caption && <p className="post-card__caption"><Link to={`/profile/${post.author.username}`}>@{post.author.username}</Link> {post.caption}</p>}
              {post.location_name && <small className="post-card__location">{post.location_name}</small>}
              {post.comments_enabled && <button className="post-card__comments-link" onClick={() => void openComments(post)}>Ver {post.comments_count} {post.comments_count === 1 ? 'comentário' : 'comentários'}</button>}
            </div>
          </article>
        ))}
      </section>

      {activeCommentsPost && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setActiveCommentsPost(null)}>
          <section className="comments-modal" role="dialog" aria-modal="true" aria-label="Comentários" onMouseDown={event => event.stopPropagation()}>
            <header><div><span className="eyebrow">CONVERSA</span><h2>Comentários</h2></div><button className="icon-button" onClick={() => setActiveCommentsPost(null)} aria-label="Fechar">×</button></header>
            <div className="comments-modal__list">
              {comments.length === 0 ? <p className="muted-copy">Ainda não há comentários. Comece a conversa com respeito.</p> : comments.map(comment => (
                <article className="comment" key={comment.id}>
                  <Avatar name={comment.author?.display_name || comment.author?.username || 'L'} src={comment.author?.avatar_url} size="sm" />
                  <p><strong>{comment.author?.display_name || comment.author?.username || 'Membro'}</strong> {comment.body}<small>{formatRelativeDate(comment.created_at)}</small></p>
                </article>
              ))}
            </div>
            <form className="comment-form" onSubmit={submitComment}>
              <input value={commentText} onChange={event => setCommentText(event.target.value)} maxLength={1000} placeholder="Escreva com respeito..." />
              <button className="icon-button icon-button--filled" disabled={!commentText.trim() || commentLoading} aria-label="Enviar comentário"><Send size={18} /></button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function FeedSkeleton() {
  return <><div className="skeleton-post" /><div className="skeleton-post" /></>
}