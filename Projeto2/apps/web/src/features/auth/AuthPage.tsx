import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { signIn, signUp } from '../../services/auth.service'

type AuthMode = 'login' | 'register'

export function AuthPage({ authenticated }: { authenticated: boolean }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')

  if (authenticated) return <Navigate to="/" replace />

  const isRegister = mode === 'register'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isRegister && !acceptedTerms) {
      toast.error('Confirme sua maioridade e aceite os termos para continuar.')
      return
    }

    setLoading(true)
    try {
      if (isRegister) {
        const result = await signUp({ email, password, displayName })
        if (!result.session) {
          toast.success('Cadastro criado. Verifique seu e-mail para confirmar o acesso.')
        } else {
          toast.success('Conta criada. Vamos concluir seu perfil.')
          navigate('/onboarding', { replace: true })
        }
      } else {
        await signIn(email, password)
        toast.success('Bem-vindo(a) de volta.')
        navigate('/', { replace: true })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível continuar.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setPassword('')
  }

  return (
    <main className="auth-page">
      <section className="auth-page__showcase">
        <div className="auth-showcase__glow auth-showcase__glow--one" />
        <div className="auth-showcase__glow auth-showcase__glow--two" />
        <Link to="/login" className="brand brand--light"><span className="brand__mark">L</span><span>LOVIX</span></Link>
        <div className="auth-showcase__copy">
          <span className="eyebrow eyebrow--light"><Sparkles size={14} /> conexões com intenção</span>
          <h1>Seu espaço para viver conexões reais.</h1>
          <p>Uma comunidade privada, respeitosa e criada para adultos que valorizam afinidade, autonomia e consentimento.</p>
        </div>
        <ul className="auth-showcase__points">
          <li><span><ShieldCheck size={18} /></span><div><strong>Privacidade por escolha</strong><small>Você controla sua presença e seu perfil.</small></div></li>
          <li><span><CheckCircle2 size={18} /></span><div><strong>Comunidade 18+</strong><small>Termos claros e moderação responsável.</small></div></li>
          <li><span><Sparkles size={18} /></span><div><strong>Conexões que fazem sentido</strong><small>Descubra pessoas por interesses e região.</small></div></li>
        </ul>
      </section>

      <section className="auth-page__form-panel">
        <div className="auth-mobile-brand brand"><span className="brand__mark">L</span><span>LOVIX</span></div>
        <div className="auth-card">
          <div className="auth-card__tabs" role="tablist" aria-label="Acesso">
            <button className={mode === 'login' ? 'is-active' : ''} onClick={() => switchMode('login')}>Entrar</button>
            <button className={mode === 'register' ? 'is-active' : ''} onClick={() => switchMode('register')}>Criar conta</button>
          </div>
          <div className="auth-card__heading">
            <span className="eyebrow">{isRegister ? 'Comece com calma' : 'Bom te ver'}</span>
            <h2>{isRegister ? 'Crie sua conta LOVIX' : 'Entre na sua conta'}</h2>
            <p>{isRegister ? 'O cadastro é exclusivo para pessoas maiores de 18 anos.' : 'Acesse sua comunidade privada.'}</p>
          </div>

          <form onSubmit={handleSubmit} className="form-stack">
            {isRegister && (
              <label className="field">
                <span>Como devemos chamar você?</span>
                <div className="field__control"><UserRound size={18} /><input required minLength={2} maxLength={60} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Seu nome ou apelido" autoComplete="name" /></div>
              </label>
            )}
            <label className="field">
              <span>E-mail</span>
              <div className="field__control"><Mail size={18} /><input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" /></div>
            </label>
            <label className="field">
              <span>Senha</span>
              <div className="field__control"><LockKeyhole size={18} /><input required minLength={6} type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="No mínimo 6 caracteres" autoComplete={isRegister ? 'new-password' : 'current-password'} /><button type="button" className="field__trailing" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </label>
            {isRegister && (
              <label className="consent-check">
                <input type="checkbox" checked={acceptedTerms} onChange={event => setAcceptedTerms(event.target.checked)} />
                <span>Confirmo que tenho <strong>18 anos ou mais</strong> e aceito os <a href="#terms">Termos de Uso</a>, a Política de Privacidade e a Política de Consentimento.</span>
              </label>
            )}
            <button className="button button--primary button--full" type="submit" disabled={loading}>
              {loading ? 'Aguarde...' : isRegister ? 'Criar minha conta' : 'Entrar agora'} <ArrowRight size={18} />
            </button>
          </form>
          {!isRegister && <button className="text-button auth-card__forgot" onClick={() => toast('A recuperação de senha será liberada nesta próxima etapa.')}>Esqueci minha senha</button>}
        </div>
        <p className="auth-page__notice">Ao continuar, você concorda em manter a comunidade segura, consentida e respeitosa.</p>
      </section>
    </main>
  )
}