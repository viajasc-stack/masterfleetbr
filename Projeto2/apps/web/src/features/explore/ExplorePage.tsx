import { Crown, Filter, MapPin, Search, Sparkles, UsersRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { LovixAppContext } from '../../app-context'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { StatusBadge } from '../../components/StatusBadge'
import { getFollowingIds, searchProfiles, toggleFollow } from '../../services/social.service'
import type { Profile } from '../../types'

type ExploreFilter = 'for-you' | 'nearby' | 'premium' | 'real'

export function ExplorePage() {
  const { user, profile: currentProfile } = useOutletContext<LovixAppContext>()
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<ExploreFilter>('for-you')

  const loadProfiles = async (nextQuery = query) => {
    setLoading(true)
    try {
      const found = await searchProfiles(nextQuery)
      const filtered = found.filter(profile => profile.id !== user.id)
      setProfiles(filtered)
      setFollowingIds(await getFollowingIds(user.id, filtered.map(profile => profile.id)))
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível buscar perfis agora.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false

    void searchProfiles('')
      .then(async found => {
        const filtered = found.filter(profile => profile.id !== user.id)
        const nextFollowingIds = await getFollowingIds(user.id, filtered.map(profile => profile.id))
        if (cancelled) return
        setProfiles(filtered)
        setFollowingIds(nextFollowingIds)
      })
      .catch(error => {
        console.error(error)
        if (!cancelled) toast.error('Não foi possível buscar perfis agora.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [user.id])

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void loadProfiles()
  }

  const handleFollow = async (targetProfile: Profile) => {
    const following = followingIds.has(targetProfile.id)
    setFollowingIds(current => {
      const next = new Set(current)
      if (following) next.delete(targetProfile.id)
      else next.add(targetProfile.id)
      return next
    })
    try {
      await toggleFollow(user.id, targetProfile.id, following)
    } catch {
      setFollowingIds(current => {
        const next = new Set(current)
        if (following) next.add(targetProfile.id)
        else next.delete(targetProfile.id)
        return next
      })
      toast.error('Não foi possível atualizar essa conexão.')
    }
  }

  const visibleProfiles = profiles.filter(profile => {
    if (activeFilter === 'nearby') return Boolean(currentProfile.city) && profile.city === currentProfile.city
    if (activeFilter === 'premium') return profile.is_premium
    if (activeFilter === 'real') return profile.is_real || profile.is_verified
    return true
  })

  const filterOptions: Array<{ id: ExploreFilter; label: string; icon: typeof Sparkles }> = [
    { id: 'for-you', label: 'Para você', icon: Sparkles },
    { id: 'nearby', label: 'Próximos', icon: MapPin },
    { id: 'premium', label: 'Premium', icon: Crown },
    { id: 'real', label: 'Perfis reais', icon: Filter },
  ]

  return (
    <div className="page page--explore">
      <section className="page-header">
        <div><span className="eyebrow"><UsersRound size={14} /> DESCOBERTA</span><h1>Encontre sua próxima conexão.</h1><p>Explore pessoas da comunidade por afinidade, interesses e região.</p></div>
      </section>
      <form className="explore-search" onSubmit={handleSearch}>
        <Search size={20} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nome, @username ou cidade" /><button className="button button--primary button--compact">Buscar</button>
      </form>
      <div className="filter-row">
        {filterOptions.map(option => {
          const Icon = option.icon
          const selected = activeFilter === option.id
          return <button key={option.id} type="button" className={`filter-chip ${selected ? 'is-active' : ''}`} aria-pressed={selected} onClick={() => setActiveFilter(option.id)}><Icon size={15} /> {option.label}</button>
        })}
      </div>
      {loading ? <div className="profile-grid profile-grid--loading"><div /><div /><div /></div> : visibleProfiles.length === 0 ? (
        <EmptyState icon={Search} title="Nenhum perfil encontrado" description="Tente outro termo ou volte mais tarde para novas conexões." />
      ) : <section className="profile-grid">
        {visibleProfiles.map(profile => {
          const following = followingIds.has(profile.id)
          return <article className="discover-card" key={profile.id}>
            <Link to={`/profile/${profile.username}`} className="discover-card__main">
              <Avatar name={profile.display_name || profile.username} src={profile.avatar_url} size="xl" />
              <div><h2>{profile.display_name || profile.username}<StatusBadge real={profile.is_real} premium={profile.is_premium} /></h2><p>@{profile.username}</p>{profile.show_city && profile.city && <small><MapPin size={14} /> {profile.city}{profile.state ? `, ${profile.state}` : ''}</small>}</div>
            </Link>
            <div className="discover-card__tags">{profile.interests.length > 0 ? profile.interests.slice(0, 3).map(interest => <span key={interest}>{interest}</span>) : <span>{profile.identity_label || 'Perfil LOVIX'}</span>}</div>
            <button className={`button ${following ? 'button--secondary' : 'button--primary'} button--full`} onClick={() => void handleFollow(profile)}>{following ? 'Seguindo' : 'Seguir'}</button>
          </article>
        })}
      </section>}
    </div>
  )
}