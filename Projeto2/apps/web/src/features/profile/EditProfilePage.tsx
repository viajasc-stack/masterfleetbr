import { ArrowLeft, Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { LovixAppContext } from '../../app-context'
import { updateMyProfile } from '../../services/profile.service'

export function EditProfilePage() {
  const { profile, refreshProfile } = useOutletContext<LovixAppContext>()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio)
  const [city, setCity] = useState(profile.city ?? '')
  const [state, setState] = useState(profile.state ?? '')
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true)
    try { await updateMyProfile({ displayName, bio, city, state }); await refreshProfile(); toast.success('Perfil atualizado.'); navigate('/profile') } catch { toast.error('Não foi possível atualizar seu perfil.') } finally { setSaving(false) }
  }
  return <div className="page page--form"><header className="page-header page-header--compact"><Link to="/profile" className="icon-button"><ArrowLeft size={20} /></Link><div><span className="eyebrow">PERFIL</span><h1>Editar perfil</h1></div></header><form className="settings-form form-stack" onSubmit={submit}><label className="field"><span>Nome ou apelido</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={60} /></label><label className="field"><span>Bio</span><textarea value={bio} onChange={event => setBio(event.target.value)} maxLength={500} rows={5} /><small>{bio.length}/500</small></label><div className="place-fields"><label className="field"><span>Cidade</span><input value={city} onChange={event => setCity(event.target.value)} /></label><label className="field field--state"><span>UF</span><input value={state} maxLength={2} onChange={event => setState(event.target.value.toUpperCase())} /></label></div><button className="button button--primary" disabled={saving}>{saving ? 'Salvando...' : <><Save size={17} /> Salvar alterações</>}</button></form></div>
}