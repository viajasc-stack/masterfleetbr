import { BadgeCheck, Save, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { Link, useOutletContext } from 'react-router-dom'
import type { LovixAppContext } from '../../app-context'
import { updateMyProfile } from '../../services/profile.service'
import type { MessageAudience } from '../../types'

export function SettingsPage() {
  const { profile, refreshProfile } = useOutletContext<LovixAppContext>()
  const [isPrivate, setIsPrivate] = useState(profile.is_private)
  const [searchVisible, setSearchVisible] = useState(profile.search_visible)
  const [showCity, setShowCity] = useState(profile.show_city)
  const [showOnlineStatus, setShowOnlineStatus] = useState(profile.show_online_status)
  const [invisibleMode, setInvisibleMode] = useState(profile.invisible_mode)
  const [allowMessagesFrom, setAllowMessagesFrom] = useState<MessageAudience>(profile.allow_messages_from)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    try {
      await updateMyProfile({ isPrivate, searchVisible, showCity, showOnlineStatus, invisibleMode, allowMessagesFrom })
      await refreshProfile()
      toast.success('Preferências salvas.')
    } catch {
      toast.error('Não foi possível salvar suas preferências.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page page--form">
      <header className="page-header">
        <div>
          <span className="eyebrow"><ShieldCheck size={14} /> PRIVACIDADE</span>
          <h1>Configurações</h1>
          <p>Controle quem encontra seu perfil, vê seus sinais públicos e pode iniciar conversas.</p>
        </div>
      </header>

      <section className="settings-callout">
        <div><span className="eyebrow"><BadgeCheck size={14} /> IDENTIDADE PRESERVADA</span><h2>Verificação manual</h2><p>Solicite selo REAL ou identidade verificada com evidência privada, expiração de arquivo e revisão auditada.</p></div>
        <Link className="button button--secondary" to="/verification"><ShieldCheck size={17} /> Abrir verificação</Link>
      </section>

      <form className="settings-form form-stack" onSubmit={submit}>
        <label className="consent-check"><input type="checkbox" checked={isPrivate} onChange={event => setIsPrivate(event.target.checked)} /><span><strong>Perfil privado</strong><br />Novas interações ficam mais restritas pelas policies do banco.</span></label>
        <label className="consent-check"><input type="checkbox" checked={searchVisible} onChange={event => setSearchVisible(event.target.checked)} /><span><strong>Aparecer na descoberta</strong><br />Permite que outros membros encontrem seu perfil na busca.</span></label>
        <label className="consent-check"><input type="checkbox" checked={showCity} onChange={event => setShowCity(event.target.checked)} /><span><strong>Mostrar cidade/UF</strong><br />Exibe localização aproximada no seu perfil.</span></label>
        <label className="consent-check"><input type="checkbox" checked={showOnlineStatus} onChange={event => setShowOnlineStatus(event.target.checked)} /><span><strong>Mostrar status online</strong><br />Permite mostrar presença quando o recurso estiver ativo.</span></label>
        <label className="consent-check"><input type="checkbox" checked={invisibleMode} onChange={event => setInvisibleMode(event.target.checked)} /><span><strong>Modo invisível</strong><br />Reduz sinais de presença sem alterar sua conta.</span></label>

        <label className="field">
          <span>Quem pode enviar mensagens</span>
          <select value={allowMessagesFrom} onChange={event => setAllowMessagesFrom(event.target.value as MessageAudience)}>
            <option value="everyone">Todos</option>
            <option value="premium">Somente Premium</option>
            <option value="followers">Somente quem sigo/seguidores</option>
            <option value="none">Ninguém</option>
          </select>
        </label>

        <button className="button button--primary" disabled={saving}><Save size={17} /> {saving ? 'Salvando...' : 'Salvar preferências'}</button>
      </form>
    </div>
  )
}