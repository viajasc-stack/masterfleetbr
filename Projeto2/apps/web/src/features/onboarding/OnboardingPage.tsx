import { ArrowRight, Check, ChevronLeft, CircleUserRound, Heart, MapPin, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { User } from '@supabase/supabase-js'
import type { Profile, ProfileType } from '../../types'
import { updateMyProfile } from '../../services/profile.service'

const identities = [
  'Mulher', 'Homem', 'Pessoa não-binária', 'Mulher trans', 'Homem trans', 'Gay', 'Lésbica', 'Bissexual', 'Pansexual', 'Outro',
]
const interests = ['Conversas leves', 'Novas amizades', 'Relacionamentos', 'Casais', 'Viagens', 'Eventos', 'Música', 'Gastronomia']

interface OnboardingPageProps {
  user: User | null
  profile: Profile | null
  onSaved: () => Promise<void>
}

export function OnboardingPage({ user, profile, onSaved }: OnboardingPageProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [profileType, setProfileType] = useState<ProfileType>(profile?.profile_type ?? 'single')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? user?.user_metadata?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username?.startsWith('user_') ? '' : profile?.username ?? '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? '')
  const [identity, setIdentity] = useState(profile?.identity_label ?? '')
  const [city, setCity] = useState(profile?.city ?? '')
  const [state, setState] = useState(profile?.state ?? '')
  const [selectedInterests, setSelectedInterests] = useState<string[]>(profile?.interests ?? [])

  if (!user) return <Navigate to="/login" replace />
  if (profile?.is_profile_complete) return <Navigate to="/" replace />

  const nextStep = () => {
    if (step === 1 && (!displayName.trim() || !username.trim() || !birthDate)) {
      toast.error('Preencha seu nome, username e data de nascimento.')
      return
    }
    if (step === 1 && new Date(`${birthDate}T12:00:00`) > new Date(new Date().setFullYear(new Date().getFullYear() - 18))) {
      toast.error('O LOVIX é exclusivo para maiores de 18 anos.')
      return
    }
    if (step === 2 && !identity) {
      toast.error('Selecione como você quer se identificar.')
      return
    }
    setStep(current => Math.min(3, current + 1))
  }

  const toggleInterest = (value: string) => setSelectedInterests(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])

  const handleComplete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!city.trim() || !state.trim()) {
      toast.error('Informe sua cidade e estado.')
      return
    }
    setLoading(true)
    try {
      await updateMyProfile({
        username: username.trim().toLowerCase().replace(/\s+/g, '_'),
        displayName: displayName.trim(),
        birthDate,
        profileType,
        identityLabel: identity,
        city: city.trim(),
        state: state.trim().toUpperCase(),
        interests: selectedInterests,
      })
      await onSaved()
      toast.success('Seu perfil está pronto. Bem-vindo(a) ao LOVIX!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar seu perfil.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <header className="onboarding-card__header">
          <div className="brand"><span className="brand__mark">L</span><span>LOVIX</span></div>
          <span className="onboarding-step">Passo {step} de 3</span>
        </header>
        <div className="onboarding-progress"><span style={{ width: `${(step / 3) * 100}%` }} /></div>
        <div className="onboarding-card__intro">
          <span className="eyebrow"><Sparkles size={14} /> SEU ESPAÇO, SUAS ESCOLHAS</span>
          <h1>{step === 1 ? 'Vamos começar pelo básico.' : step === 2 ? 'Como você quer aparecer?' : 'Onde suas conexões começam?'}</h1>
          <p>{step === 1 ? 'Essas informações ajudam a manter a comunidade segura e a criar seu perfil.' : step === 2 ? 'Você pode editar suas preferências de visibilidade quando quiser.' : 'Seu perfil será encontrado por pessoas que compartilham seus interesses.'}</p>
        </div>

        {step === 1 && (
          <div className="onboarding-form form-stack">
            <label className="field"><span>Nome ou apelido</span><input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={60} placeholder="Como quer ser chamado(a)?" /></label>
            <label className="field"><span>Nome de usuário</span><div className="username-input"><span>@</span><input value={username} onChange={event => setUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} minLength={3} maxLength={30} placeholder="seu_nick" /></div><small>Use letras, números ou _</small></label>
            <label className="field"><span>Data de nascimento</span><input value={birthDate} onChange={event => setBirthDate(event.target.value)} type="date" max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().slice(0, 10)} /></label>
            <div className="safe-note"><ShieldCheck size={18} /><span>Informação usada somente para confirmar que você tem mais de 18 anos. Ela não fica visível no seu perfil.</span></div>
            <button className="button button--primary button--full" onClick={nextStep}>Continuar <ArrowRight size={18} /></button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-form form-stack">
            <div className="choice-label"><span>Tipo de perfil</span><small>Escolha a forma que representa você.</small></div>
            <div className="type-choices">
              <button className={profileType === 'single' ? 'selected' : ''} onClick={() => setProfileType('single')}><CircleUserRound size={24} /><strong>Individual</strong><small>Um perfil para você</small><Check size={17} /></button>
              <button className={profileType === 'couple' ? 'selected' : ''} onClick={() => setProfileType('couple')}><UsersRound size={24} /><strong>Casal</strong><small>Um perfil compartilhado</small><Check size={17} /></button>
            </div>
            <div className="choice-label"><span>Identidade</span><small>Escolha a opção que te deixa confortável.</small></div>
            <div className="identity-grid">{identities.map(value => <button key={value} className={identity === value ? 'selected' : ''} onClick={() => setIdentity(value)}>{identity === value && <Check size={14} />}{value}</button>)}</div>
            <div className="onboarding-actions"><button className="button button--secondary" onClick={() => setStep(1)}><ChevronLeft size={18} /> Voltar</button><button className="button button--primary" onClick={nextStep}>Continuar <ArrowRight size={18} /></button></div>
          </div>
        )}

        {step === 3 && (
          <form className="onboarding-form form-stack" onSubmit={handleComplete}>
            <div className="place-fields"><label className="field"><span>Cidade</span><div className="field__control"><MapPin size={18} /><input value={city} onChange={event => setCity(event.target.value)} placeholder="Sua cidade" /></div></label><label className="field field--state"><span>UF</span><input value={state} onChange={event => setState(event.target.value)} maxLength={2} placeholder="SP" /></label></div>
            <div className="choice-label"><span>Seus interesses <em>opcional</em></span><small>Selecione o que ajuda a criar conexões relevantes.</small></div>
            <div className="interest-grid">{interests.map(value => <button type="button" key={value} className={selectedInterests.includes(value) ? 'selected' : ''} onClick={() => toggleInterest(value)}><Heart size={14} fill={selectedInterests.includes(value) ? 'currentColor' : 'none'} /> {value}</button>)}</div>
            <div className="onboarding-actions"><button type="button" className="button button--secondary" onClick={() => setStep(2)}><ChevronLeft size={18} /> Voltar</button><button className="button button--primary" disabled={loading}>{loading ? 'Salvando...' : 'Concluir meu perfil'} <ArrowRight size={18} /></button></div>
          </form>
        )}
      </section>
    </main>
  )
}