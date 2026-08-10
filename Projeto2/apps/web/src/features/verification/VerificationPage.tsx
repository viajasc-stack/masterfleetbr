import { BadgeCheck, Clock3, FileCheck2, ShieldCheck, UploadCloud } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { useOutletContext } from 'react-router-dom'
import type { LovixAppContext } from '../../app-context'
import { getRuntimeSettings } from '../../services/settings.service'
import { createVerificationRequest, listMyVerificationRequests, uploadVerificationEvidence } from '../../services/verification.service'
import type { RuntimeSettings, VerificationRequest, VerificationType } from '../../types'

const statusLabel: Record<string, string> = { pending: 'Pendente', in_review: 'Em análise', approved: 'Aprovada', rejected: 'Rejeitada', expired: 'Expirada' }
const typeLabel: Record<VerificationType, string> = { real_profile: 'Perfil REAL', identity: 'Identidade verificada', age_18: 'Maioridade 18+' }

export function VerificationPage() {
  const { user, profile, refreshProfile } = useOutletContext<LovixAppContext>()
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [type, setType] = useState<VerificationType>('real_profile')
  const [file, setFile] = useState<File | null>(null)
  const [settings, setSettings] = useState<RuntimeSettings>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const latest = requests[0]
  const hasOpenRequest = useMemo(() => requests.some(item => item.type === type && ['pending', 'in_review'].includes(item.status)), [requests, type])

  const load = async () => {
    setLoading(true)
    try { setRequests(await listMyVerificationRequests()) } catch (error) { console.error(error); toast.error('Não foi possível carregar suas verificações.') } finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    Promise.all([listMyVerificationRequests(), getRuntimeSettings(['verification'])])
      .then(([nextRequests, nextSettings]) => { if (!active) return; setRequests(nextRequests); setSettings(nextSettings) })
      .catch(error => { console.error(error); if (active) toast.error('Não foi possível carregar suas verificações.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) { toast.error('Selecione uma evidência para análise.'); return }
    setSubmitting(true)
    try {
      const verificationSettings = settings.verification ?? {}
      const evidencePath = await uploadVerificationEvidence(user.id, file, { maxMb: Number(verificationSettings.maxEvidenceMb ?? 10), allowVideo: verificationSettings.allowVideoEvidence !== false })
      await createVerificationRequest(type, evidencePath, file.type)
      await Promise.all([load(), refreshProfile()])
      setFile(null)
      toast.success('Solicitação enviada para análise manual.')
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a verificação.')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="page page--form">
      <header className="page-header">
        <div><span className="eyebrow"><ShieldCheck size={14} /> VERIFICAÇÃO PRIVADA</span><h1>Verificação manual LOVIX</h1><p>Envie uma evidência privada para receber selo REAL ou identidade verificada sem expor seus documentos no perfil público.</p></div>
      </header>

      <section className="verification-hero">
        <div><BadgeCheck size={24} /><strong>{profile.is_real ? 'Perfil REAL ativo' : 'Perfil REAL pendente'}</strong><span>{profile.is_verified ? 'Identidade verificada' : 'Identidade ainda não verificada'}</span></div>
        <div><Clock3 size={24} /><strong>{latest ? statusLabel[latest.status] : 'Nenhuma solicitação'}</strong><span>{latest ? `${typeLabel[latest.type]} · ${new Date(latest.created_at).toLocaleDateString('pt-BR')}` : 'Comece enviando uma evidência abaixo.'}</span></div>
      </section>

      <form className="settings-form form-stack" onSubmit={submit}>
        <div className="type-choices verification-types">
          <button type="button" className={type === 'real_profile' ? 'selected' : ''} onClick={() => setType('real_profile')}><FileCheck2 size={20} /><strong>Perfil REAL</strong><small>Selfie, foto ou vídeo com gesto/frase combinada para provar presença real.</small><BadgeCheck size={16} /></button>
          <button type="button" className={type === 'identity' ? 'selected' : ''} onClick={() => setType('identity')}><ShieldCheck size={20} /><strong>Identidade</strong><small>Documento ou evidência equivalente analisada manualmente e mantida privada.</small><BadgeCheck size={16} /></button>
          <button type="button" className={type === 'age_18' ? 'selected' : ''} onClick={() => setType('age_18')}><ShieldCheck size={20} /><strong>Maioridade 18+</strong><small>Confirmação manual de elegibilidade adulta com evidência privada e expiração.</small><BadgeCheck size={16} /></button>
        </div>

        <div className="safe-note"><ShieldCheck size={17} /><span><strong>Preservação de identidade:</strong> o arquivo fica em bucket privado, sem URL pública, expira em 7 dias e o acesso administrativo é auditado. Apenas status/selo aparecem publicamente.</span></div>

        <label className="field">
          <span>Evidência privada</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          <small>JPG, PNG, WEBP{settings.verification?.allowVideoEvidence === false ? '' : ' ou MP4'} até {String(settings.verification?.maxEvidenceMb ?? 10)}MB. Evite dados além do necessário.</small>
        </label>

        {hasOpenRequest && <p className="muted-copy">Você já possui uma solicitação desse tipo em análise. Aguarde a moderação antes de reenviar.</p>}

        <button className="button button--primary" disabled={submitting || hasOpenRequest}><UploadCloud size={17} /> {submitting ? 'Enviando...' : 'Enviar para verificação manual'}</button>
      </form>

      <section className="verification-history">
        <h2>Histórico</h2>
        {loading ? <div className="profile-skeleton" /> : requests.length === 0 ? <p className="muted-copy">Nenhuma solicitação enviada ainda.</p> : requests.map(item => <article className="admin-card admin-card--compact" key={item.id}><div><span className={`admin-pill admin-pill--${item.status}`}>{statusLabel[item.status]}</span><h3>{typeLabel[item.type]}</h3><p>{item.rejection_reason_public || 'Sem observações públicas da moderação.'}</p><small>Criada em {new Date(item.created_at).toLocaleString('pt-BR')} · evidência expira em {new Date(item.evidence_expires_at).toLocaleDateString('pt-BR')}</small></div></article>)}
      </section>
    </div>
  )
}