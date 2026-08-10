import { Bell, Compass, House, LogOut, MessageCircle, PlusSquare, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { LovixAppContext } from '../app-context'
import { signOut } from '../services/auth.service'
import { Avatar } from './Avatar'

const navigationItems = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/explore', label: 'Explorar', icon: Compass },
  { to: '/create', label: 'Publicar', icon: PlusSquare },
  { to: '/messages', label: 'Mensagens', icon: MessageCircle },
  { to: '/premium', label: 'Premium', icon: Sparkles },
]

export function AppShell({ context }: { context: LovixAppContext }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      toast.error('Não foi possível encerrar sua sessão.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand brand--sidebar" end>
          <span className="brand__mark">L</span>
          <span>LOVIX</span>
        </NavLink>

        <nav className="sidebar__nav" aria-label="Navegação principal">
          {navigationItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link">
              <Icon size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </NavLink>
          ))}
          {context.profile.is_admin && (
            <NavLink to="/admin" className="nav-link">
              <ShieldCheck size={20} strokeWidth={1.8} />
              <span>Administração</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar__account">
          <NavLink to="/profile" className="account-card">
            <Avatar name={context.profile.display_name || context.profile.username} src={context.profile.avatar_url} />
            <span>
              <strong>{context.profile.display_name || context.profile.username}</strong>
              <small>@{context.profile.username}</small>
            </span>
          </NavLink>
          <button className="icon-button icon-button--ghost" onClick={handleLogout} aria-label="Sair">
            <LogOut size={19} />
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <NavLink to="/" className="brand" end><span className="brand__mark">L</span><span>LOVIX</span></NavLink>
        <div className="mobile-header__actions">
          <NavLink to="/messages" className="icon-button" aria-label="Mensagens"><MessageCircle size={20} /></NavLink>
          <NavLink to="/profile" className="profile-button" aria-label="Seu perfil">
            <Avatar name={context.profile.display_name || context.profile.username} src={context.profile.avatar_url} size="sm" />
          </NavLink>
        </div>
      </header>

      <main className="main-content">
        <Outlet context={context} />
      </main>

      <nav className="bottom-nav" aria-label="Navegação móvel">
        {navigationItems.slice(0, 4).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom-nav__item" aria-label={label}>
            <Icon size={21} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/profile" className="bottom-nav__item" aria-label="Perfil">
          <UserRound size={21} strokeWidth={1.8} />
          <span>Perfil</span>
        </NavLink>
      </nav>
      <NavLink to="/notifications" className="notifications-shortcut" aria-label="Notificações"><Bell size={19} /></NavLink>
    </div>
  )
}