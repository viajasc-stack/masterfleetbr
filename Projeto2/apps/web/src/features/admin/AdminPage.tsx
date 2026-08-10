import { Activity, Ban, CheckCircle2, Crown, Eye, FileCheck2, FileWarning, Gauge, History, Layers3, MessageSquareWarning, RotateCcw, Save, Search, Settings2, ShieldCheck, Sparkles, Trash2, TrendingUp, UserCheck, UserCog, UsersRound, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { useOutletContext } from 'react-router-dom'
import type { LovixAppContext } from '../../app-context'
import { Avatar } from '../../components/Avatar'
import { EmptyState } from '../../components/EmptyState'
import { formatRelativeDate } from '../../lib/format'
import { cleanupExpiredVerificationEvidence, deleteAdminVerificationEvidence, getAdminPostDetail, getAdminUserDetail, getAdminVerificationDetail, getAdminDashboardMetrics, getAdminSaasMetrics, grantAdminPremium, listAdminAuditLogs, listAdminPosts, listAdminProfiles, listAdminReports, listAdminRoles, listAdminSettings, listAdminVerificationRequests, openAdminVerificationEvidence, resolveAdminReport, reviewAdminVerification, revokeAdminPremium, setAdminPostModeration, setAdminProfileFlags, setAdminRole, setAdminUserStatus, updateAdminSetting } from '../../services/admin.service'
import type { AdminAuditLog, AdminDashboardMetrics, AdminDetailPayload, AdminPost, AdminProfile, AdminReport, AdminRole, AdminSaasMetrics, AdminSetting, AdminVerificationRequest, VerificationStatus } from '../../types'

type AdminTab = 'dashboard' | 'users' | 'reports' | 'content' | 'verification' | 'settings' | 'audit'
type DrawerState = { title: string; payload: AdminDetailPayload } | null

const tabs: Array<{ id: AdminTab; label: string; icon: typeof Gauge }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'users', label: 'Usuários', icon: UsersRound },
  { id: 'reports', label: 'Denúncias', icon: MessageSquareWarning },
  { id: 'content', label: 'Conteúdo', icon: FileWarning },
  { id: 'verification', label: 'Verificações', icon: FileCheck2 },
  { id: 'settings', label: 'Configurações', icon: Settings2 },
  { id: 'audit', label: 'Auditoria', icon: History },
]

const statusLabel: Record<string, string> = {
  active: 'Ativo', review: 'Revisão', suspended: 'Suspenso', banned: 'Banido', hidden: 'Oculto', removed: 'Removido', open: 'Aberta', reviewing: 'Em revisão', resolved: 'Resolvida', dismissed: 'Descartada', public: 'Público', followers: 'Seguidores', following: 'Quem sigo', private: 'Apenas eu', pending: 'Pendente', in_review: 'Em análise', approved: 'Aprovada', rejected: 'Rejeitada', expired: 'Expirada',
}
const verificationTypeLabel: Record<string, string> = { real_profile: 'Perfil REAL', identity: 'Identidade', age_18: 'Maioridade 18+' }

const askReason = (fallback: string) => window.prompt('Motivo da ação para auditoria:', fallback)?.trim() ?? ''

export function AdminPage() {
  const { profile } = useOutletContext<LovixAppContext>()
  const [tab, setTab] = useState<AdminTab>('dashboard')
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null)
  const [saasMetrics, setSaasMetrics] = useState<AdminSaasMetrics | null>(null)
  const [profiles, setProfiles] = useState<AdminProfile[]>([])
  const [reports, setReports] = useState<AdminReport[]>([])
  const [posts, setPosts] = useState<AdminPost[]>([])
  const [verifications, setVerifications] = useState<AdminVerificationRequest[]>([])
  const [settings, setSettings] = useState<AdminSetting[]>([])
  const [roles, setRoles] = useState<AdminRole[]>([])
  const [logs, setLogs] = useState<AdminAuditLog[]>([])
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [query, setQuery] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('')
  const [reportStatusFilter, setReportStatusFilter] = useState('')
  const [contentStatusFilter, setContentStatusFilter] = useState('')
  const [contentPrivacyFilter, setContentPrivacyFilter] = useState('')
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | ''>('')
  const [loading, setLoading] = useState(true)

  const loadAll = async (nextQuery = query) => {
    setLoading(true)
    try {
      const [nextMetrics, nextSaasMetrics, nextProfiles, nextReports, nextPosts, nextVerifications, nextSettings, nextRoles, nextLogs] = await Promise.all([
        getAdminDashboardMetrics(), getAdminSaasMetrics(), listAdminProfiles(nextQuery), listAdminReports(reportStatusFilter), listAdminPosts(contentStatusFilter, contentPrivacyFilter), listAdminVerificationRequests(verificationStatus), listAdminSettings(), listAdminRoles(), listAdminAuditLogs(),
      ])
      setMetrics(nextMetrics); setSaasMetrics(nextSaasMetrics); setProfiles(nextProfiles); setReports(nextReports); setPosts(nextPosts); setVerifications(nextVerifications); setSettings(nextSettings); setRoles(nextRoles); setLogs(nextLogs)
    } catch (error) {
      console.error(error)
      toast.error('Não foi possível carregar o painel administrativo.')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      getAdminDashboardMetrics(), getAdminSaasMetrics(), listAdminProfiles(''), listAdminReports(), listAdminPosts(), listAdminVerificationRequests(), listAdminSettings(), listAdminRoles(), listAdminAuditLogs(),
    ])
      .then(([nextMetrics, nextSaasMetrics, nextProfiles, nextReports, nextPosts, nextVerifications, nextSettings, nextRoles, nextLogs]) => {
        if (!active) return
        setMetrics(nextMetrics); setSaasMetrics(nextSaasMetrics); setProfiles(nextProfiles); setReports(nextReports); setPosts(nextPosts); setVerifications(nextVerifications); setSettings(nextSettings); setRoles(nextRoles); setLogs(nextLogs)
      })
      .catch(error => {
        console.error(error)
        if (active) toast.error('Não foi possível carregar o painel administrativo.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const search = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void loadAll(query) }

  const filterVerifications = async (status: VerificationStatus | '') => {
    setVerificationStatus(status); setLoading(true)
    try { setVerifications(await listAdminVerificationRequests(status)) } catch (error) { console.error(error); toast.error('Não foi possível filtrar verificações.') } finally { setLoading(false) }
  }

  const filterReports = async (status: string) => { setReportStatusFilter(status); setLoading(true); try { setReports(await listAdminReports(status)) } catch (error) { console.error(error); toast.error('Não foi possível filtrar denúncias.') } finally { setLoading(false) } }
  const filterContent = async (status = contentStatusFilter, privacy = contentPrivacyFilter) => { setContentStatusFilter(status); setContentPrivacyFilter(privacy); setLoading(true); try { setPosts(await listAdminPosts(status, privacy)) } catch (error) { console.error(error); toast.error('Não foi possível filtrar conteúdos.') } finally { setLoading(false) } }

  const action = async (work: () => Promise<unknown>, success: string) => {
    try { await work(); toast.success(success); await loadAll() } catch (error) { console.error(error); toast.error('Ação administrativa não concluída.') }
  }

  const openDetail = async (title: string, work: () => Promise<AdminDetailPayload>) => {
    try { setDrawer({ title: 'Carregando detalhe...', payload: {} }); setDrawer({ title, payload: await work() }) } catch (error) { console.error(error); setDrawer(null); toast.error('Não foi possível carregar o detalhe.') }
  }

  const reportOpenCount = useMemo(() => reports.filter(report => ['open', 'reviewing'].includes(report.status)).length, [reports])
  const visibleProfiles = useMemo(() => profiles.filter(item => !userStatusFilter || item.moderation_status === userStatusFilter), [profiles, userStatusFilter])
  const verificationOpenCount = useMemo(() => verifications.filter(item => ['pending', 'in_review'].includes(item.status)).length, [verifications])
  const contentQueueCount = useMemo(() => posts.filter(post => ['review', 'hidden'].includes(post.moderation_status)).length, [posts])
  const suspendedQueueCount = useMemo(() => profiles.filter(item => ['review', 'suspended', 'banned'].includes(item.moderation_status)).length, [profiles])

  if (!profile.is_admin) return <div className="page"><EmptyState icon={ShieldCheck} title="Acesso restrito" description="Este painel é exclusivo para administradores." /></div>

  return (
    <div className="page page--admin admin-suite">
      <header className="admin-hero">
        <div className="admin-hero__copy"><span className="eyebrow eyebrow--light"><ShieldCheck size={15} /> ADMINISTRAÇÃO LOVIX</span><h1>Command Center SaaS</h1><p>Operação profissional para moderação, confiança, receita Premium e verificação manual com trilha de auditoria.</p><div className="admin-hero__meta"><span><Activity size={14} /> Operação ativa</span><span><TrendingUp size={14} /> {metrics?.premiumActive ?? 0} Premium</span><span><Layers3 size={14} /> {verificationOpenCount + reportOpenCount + contentQueueCount} itens em fila</span></div></div>
        <div className="admin-hero__panel"><strong>Busca global</strong><span>Usuários, cidade ou username</span><form className="admin-search" onSubmit={search}><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar na base" /><button className="button button--secondary button--compact">Buscar</button></form></div>
      </header>

      <nav className="admin-tabs" aria-label="Seções administrativas">{tabs.map(item => { const Icon = item.icon; return <button key={item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}><Icon size={17} /> {item.label}</button> })}</nav>

      {loading ? <div className="profile-skeleton" /> : (
        <>
          {tab === 'dashboard' && <section className="admin-grid admin-grid--metrics">
            <Metric icon={UsersRound} title="Usuários" value={metrics?.usersTotal} detail={`${metrics?.usersActive ?? 0} ativos`} />
            <Metric icon={Crown} title="Premium" value={metrics?.premiumActive} detail="assinantes ativos" />
            <Metric icon={MessageSquareWarning} title="Denúncias" value={metrics?.reportsOpen ?? reportOpenCount} detail="abertas/em revisão" tone="warning" />
            <Metric icon={FileWarning} title="Conteúdos" value={metrics?.postsTotal} detail={`${metrics?.postsReview ?? 0} em revisão`} />
            <Metric icon={Ban} title="Suspensos" value={metrics?.usersSuspended} detail={`${metrics?.usersBanned ?? 0} banidos`} tone="danger" />
            <Metric icon={FileCheck2} title="Verificações" value={verificationOpenCount} detail="pendentes/em análise" tone="warning" />
          </section>}

          {tab === 'dashboard' && <section className="admin-grid admin-grid--metrics admin-grid--saas"><Metric icon={TrendingUp} title="Novos 7d" value={saasMetrics?.users7d} detail={`${saasMetrics?.users30d ?? 0} nos últimos 30d`} /><Metric icon={Activity} title="Posts 7d" value={saasMetrics?.posts7d} detail="produção recente" /><Metric icon={Crown} title="Conversão" value={saasMetrics?.premiumConversionPct} detail="% Premium" /><Metric icon={FileCheck2} title="Aprovação" value={saasMetrics?.approvedVerificationRatePct} detail="% verificações" /><Metric icon={Gauge} title="SLA médio" value={saasMetrics?.avgVerificationHours} detail="horas até revisão" /><Metric icon={TrendingUp} title="MRR est." value={Math.round((saasMetrics?.estimatedMrrCents ?? 0) / 100)} detail="R$ estimados" /></section>}

          {tab === 'dashboard' && <section className="admin-command-grid"><article className="admin-panel"><div className="admin-section-heading"><span><Gauge size={16} /> Filas operacionais</span><small>Prioridade para hoje</small></div><div className="admin-queue-list"><QueueItem label="Verificações manuais" value={verificationOpenCount} tone="warning" /><QueueItem label="Denúncias abertas" value={reportOpenCount} tone="danger" /><QueueItem label="Conteúdos em revisão" value={contentQueueCount} tone="warning" /><QueueItem label="Usuários com restrição" value={suspendedQueueCount} tone="danger" /></div></article><article className="admin-panel admin-panel--gradient"><div className="admin-section-heading"><span><ShieldCheck size={16} /> Confiança & compliance</span><small>Status de segurança</small></div><p>Dados sensíveis permanecem privados, ações críticas pedem motivo e ficam registradas em auditoria. A verificação manual preserva identidade e evita URLs públicas.</p><div className="admin-health"><span>RLS ativo</span><span>RPC auditada</span><span>Storage privado</span></div></article></section>}

          {tab === 'users' && <section className="admin-list"><SectionHeading title="Gestão de usuários" detail={`${visibleProfiles.length}/${profiles.length} perfis`} /><div className="admin-toolbar"><label className="field"><span>Status</span><select value={userStatusFilter} onChange={event => setUserStatusFilter(event.target.value)}><option value="">Todos</option><option value="active">Ativo</option><option value="review">Revisão</option><option value="suspended">Suspenso</option><option value="banned">Banido</option></select></label></div>{visibleProfiles.map(item => <UserRow key={item.id} item={item} onAction={action} onOpenDetail={() => openDetail(`Perfil @${item.username}`, () => getAdminUserDetail(item.id))} />)}</section>}

          {tab === 'reports' && <section className="admin-list"><SectionHeading title="Central de denúncias" detail={`${reportOpenCount} abertas/em revisão`} /><div className="admin-toolbar"><label className="field"><span>Status</span><select value={reportStatusFilter} onChange={event => void filterReports(event.target.value)}><option value="">Todos</option><option value="open">Aberta</option><option value="reviewing">Em revisão</option><option value="resolved">Resolvida</option><option value="dismissed">Descartada</option></select></label></div>{reports.length === 0 ? <EmptyState icon={MessageSquareWarning} title="Nenhuma denúncia" description="As denúncias da comunidade aparecerão aqui." /> : reports.map(report => <article className="admin-card" key={report.id}><div><span className={`admin-pill admin-pill--${report.status}`}>{statusLabel[report.status] ?? report.status}</span><h3>{statusLabel[report.reason] ?? report.reason}</h3><p>{report.details || 'Sem detalhes adicionais.'}</p><small>Denunciante @{report.reporter_username ?? 'perfil'} · Denunciado @{report.reported_username ?? 'perfil'} · {formatRelativeDate(report.created_at)}</small></div><div className="admin-actions"><button className="button button--secondary button--compact" onClick={() => action(() => resolveAdminReport(report.id, 'reviewing', askReason('Análise iniciada')), 'Denúncia em revisão.')}>Revisar</button><button className="button button--primary button--compact" onClick={() => action(() => resolveAdminReport(report.id, 'resolved', askReason('Resolvida pela moderação')), 'Denúncia resolvida.')}>Resolver</button><button className="button button--secondary button--compact" onClick={() => action(() => resolveAdminReport(report.id, 'dismissed', askReason('Descartada pela moderação')), 'Denúncia descartada.')}>Descartar</button></div></article>)}</section>}

          {tab === 'content' && <section className="admin-list"><SectionHeading title="Moderação de conteúdo" detail={`${contentQueueCount} itens exigem atenção`} /><div className="admin-toolbar"><label className="field"><span>Status</span><select value={contentStatusFilter} onChange={event => void filterContent(event.target.value, contentPrivacyFilter)}><option value="">Todos</option><option value="active">Ativo</option><option value="review">Revisão</option><option value="hidden">Oculto</option><option value="removed">Removido</option></select></label><label className="field"><span>Privacidade</span><select value={contentPrivacyFilter} onChange={event => void filterContent(contentStatusFilter, event.target.value)}><option value="">Todas</option><option value="public">Público</option><option value="followers">Seguidores</option><option value="following">Quem sigo</option><option value="private">Privado</option></select></label></div>{posts.map(post => <article className="admin-card" key={post.id}><div><span className={`admin-pill admin-pill--${post.moderation_status}`}>{statusLabel[post.moderation_status] ?? post.moderation_status}</span><span className="admin-pill">{statusLabel[post.privacy] ?? post.privacy}</span><h3>@{post.author_username} · {post.author_display_name}</h3><p>{post.caption || 'Publicação sem legenda.'}</p><small>{post.likes_count} curtidas · {post.comments_count} comentários · {post.media_count} mídia(s) · {formatRelativeDate(post.created_at)}</small></div><div className="admin-actions"><button className="button button--secondary button--compact" onClick={() => openDetail(`Post ${post.id.slice(0, 8)}`, () => getAdminPostDetail(post.id))}><Eye size={14} /> Detalhes</button><button className="button button--secondary button--compact" onClick={() => action(() => setAdminPostModeration(post.id, 'review', askReason('Enviado para revisão')), 'Post em revisão.')}>Revisar</button><button className="button button--secondary button--compact" onClick={() => action(() => setAdminPostModeration(post.id, 'hidden', askReason('Ocultado pela moderação')), 'Post ocultado.')}>Ocultar</button><button className="button button--primary button--compact" onClick={() => action(() => setAdminPostModeration(post.id, 'active', askReason('Restaurado pela moderação')), 'Post restaurado.')}>Restaurar</button><button className="button button--secondary button--compact" onClick={() => action(() => setAdminPostModeration(post.id, 'removed', askReason('Removido pela moderação')), 'Post removido.')}>Remover</button></div></article>)}</section>}

          {tab === 'verification' && <section className="admin-list"><SectionHeading title="Verificações privadas" detail={`${verificationOpenCount} solicitações abertas`} /><div className="admin-toolbar"><label className="field"><span>Status</span><select value={verificationStatus} onChange={event => void filterVerifications(event.target.value as VerificationStatus | '')}><option value="">Todos</option><option value="pending">Pendente</option><option value="in_review">Em análise</option><option value="approved">Aprovada</option><option value="rejected">Rejeitada</option><option value="expired">Expirada</option></select></label></div>{verifications.length === 0 ? <EmptyState icon={FileCheck2} title="Nenhuma verificação" description="Solicitações manuais aparecerão aqui para análise privada." /> : verifications.map(item => <VerificationRow key={item.id} item={item} onAction={action} onOpenDetail={() => openDetail(`Verificação @${item.username}`, () => getAdminVerificationDetail(item.id))} />)}</section>}

          {tab === 'settings' && <SettingsPanel settings={settings} roles={roles} profiles={profiles} onAction={action} />}

          {tab === 'audit' && <section className="admin-list"><SectionHeading title="Auditoria administrativa" detail={`${logs.length} eventos recentes`} />{logs.map(log => <article className="admin-card admin-card--compact" key={log.id}><div><span className="admin-pill">{log.action}</span><h3>{log.target_type}: {log.target_id}</h3><p>{log.reason || 'Sem motivo informado.'}</p><small>@{log.admin_username ?? 'admin'} · {formatRelativeDate(log.created_at)}</small></div></article>)}</section>}
        </>
      )}
      {drawer && <DetailDrawer drawer={drawer} onClose={() => setDrawer(null)} />}
    </div>
  )
}

function Metric({ icon: Icon, title, value, detail, tone }: { icon: typeof Gauge; title: string; value?: number; detail: string; tone?: 'warning' | 'danger' }) {
  return <article className={`admin-metric ${tone ? `admin-metric--${tone}` : ''}`}><span className="admin-metric__icon"><Icon size={18} /></span><strong>{value ?? 0}</strong><span>{title}</span><small>{detail}</small></article>
}

function QueueItem({ label, value, tone }: { label: string; value: number; tone?: 'warning' | 'danger' }) {
  return <div className={`admin-queue-item ${tone ? `admin-queue-item--${tone}` : ''}`}><span>{label}</span><strong>{value}</strong></div>
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return <div className="admin-section-heading admin-section-heading--list"><span>{title}</span><small>{detail}</small></div>
}

function UserRow({ item, onAction, onOpenDetail }: { item: AdminProfile; onAction: (work: () => Promise<unknown>, success: string) => Promise<void>; onOpenDetail: () => void }) {
  return <article className="admin-card"><div className="admin-user"><Avatar name={item.display_name || item.username} src={item.avatar_url} /><div><span className={`admin-pill admin-pill--${item.moderation_status}`}>{statusLabel[item.moderation_status] ?? item.moderation_status}</span>{item.is_admin && <span className="admin-pill admin-pill--admin">Admin</span>}{item.is_premium && <span className="admin-pill admin-pill--premium">Premium</span>}<h3>{item.display_name || item.username}</h3><p>@{item.username} {item.city ? `· ${item.city}${item.state ? `, ${item.state}` : ''}` : ''}</p><small>{item.premium_until ? `Premium até ${new Date(item.premium_until).toLocaleDateString('pt-BR')}` : 'Sem Premium ativo'}</small></div></div><div className="admin-actions"><button className="button button--secondary button--compact" onClick={onOpenDetail}><Eye size={14} /> Detalhes</button><button className="button button--secondary button--compact" onClick={() => onAction(() => setAdminUserStatus(item.id, 'active', askReason('Restaurado pelo admin')), 'Usuário restaurado.')}><RotateCcw size={14} /> Restaurar</button><button className="button button--secondary button--compact" onClick={() => onAction(() => setAdminUserStatus(item.id, 'suspended', askReason('Suspensão administrativa')), 'Usuário suspenso.')}><Ban size={14} /> Suspender</button><button className="button button--secondary button--compact" onClick={() => onAction(() => setAdminUserStatus(item.id, 'banned', askReason('Banimento administrativo')), 'Usuário banido.')}><Ban size={14} /> Banir</button><button className="button button--primary button--compact" onClick={() => onAction(() => grantAdminPremium(item.id, 30, askReason('Premium manual 30 dias')), 'Premium 30 dias concedido.')}><Crown size={14} /> +30</button><button className="button button--primary button--compact" onClick={() => onAction(() => grantAdminPremium(item.id, 60, askReason('Premium manual 60 dias')), 'Premium 60 dias concedido.')}><Sparkles size={14} /> +60</button><button className="button button--primary button--compact" onClick={() => onAction(() => grantAdminPremium(item.id, 90, askReason('Premium manual 90 dias')), 'Premium 90 dias concedido.')}><Sparkles size={14} /> +90</button><button className="button button--secondary button--compact" onClick={() => onAction(() => revokeAdminPremium(item.id, askReason('Premium removido manualmente')), 'Premium removido.')}><Crown size={14} /> Remover</button><button className="button button--secondary button--compact" onClick={() => onAction(() => setAdminProfileFlags(item.id, !item.is_real, undefined), 'Selo REAL atualizado.')}><UserCheck size={14} /> REAL</button><button className="button button--secondary button--compact" onClick={() => onAction(() => setAdminProfileFlags(item.id, undefined, !item.is_verified), 'Verificação atualizada.')}><CheckCircle2 size={14} /> Verificar</button></div></article>
}

function VerificationRow({ item, onAction, onOpenDetail }: { item: AdminVerificationRequest; onAction: (work: () => Promise<unknown>, success: string) => Promise<void>; onOpenDetail: () => void }) {
  return <article className="admin-card"><div className="admin-user"><Avatar name={item.display_name || item.username} src={item.avatar_url} /><div><span className={`admin-pill admin-pill--${item.status}`}>{statusLabel[item.status] ?? item.status}</span><span className="admin-pill">{verificationTypeLabel[item.type] ?? item.type}</span><h3>{item.display_name || item.username}</h3><p>@{item.username} · {item.evidence_mime_type ?? 'sem evidência'}</p><small>Criada {formatRelativeDate(item.created_at)} · expira {new Date(item.evidence_expires_at).toLocaleDateString('pt-BR')}{item.reviewed_at ? ` · revisada ${formatRelativeDate(item.reviewed_at)}` : ''}</small>{item.rejection_reason_public && <p>Motivo público: {item.rejection_reason_public}</p>}{item.review_notes_private && <p>Nota privada: {item.review_notes_private}</p>}</div></div><div className="admin-actions"><button className="button button--secondary button--compact" onClick={onOpenDetail}><Eye size={14} /> Detalhes</button><button className="button button--secondary button--compact" disabled={!item.evidence_path} onClick={() => onAction(() => openAdminVerificationEvidence(item.id), 'Acesso à evidência auditado.')}><Eye size={14} /> Abrir evidência</button><button className="button button--secondary button--compact" onClick={() => onAction(() => reviewAdminVerification(item.id, 'in_review', askReason('Análise iniciada')), 'Verificação em análise.')}><FileCheck2 size={14} /> Em análise</button><button className="button button--primary button--compact" onClick={() => onAction(() => reviewAdminVerification(item.id, 'approved', askReason('Aprovada como perfil REAL')), 'Perfil REAL aprovado.')}><UserCheck size={14} /> Aprovar REAL</button><button className="button button--primary button--compact" onClick={() => onAction(() => reviewAdminVerification(item.id, 'approved', askReason('Identidade verificada')), 'Verificação aprovada.')}><CheckCircle2 size={14} /> Aprovar verificado</button><button className="button button--secondary button--compact" onClick={() => onAction(() => reviewAdminVerification(item.id, 'rejected', askReason('Evidência insuficiente')), 'Verificação rejeitada.')}><Ban size={14} /> Rejeitar</button><button className="button button--secondary button--compact" disabled={!item.evidence_path} onClick={() => onAction(() => deleteAdminVerificationEvidence(item.id, askReason('Exclusão manual de evidência')), 'Evidência apagada.')}><Trash2 size={14} /> Apagar evidência</button></div></article>
}

function SettingsPanel({ settings, roles, profiles, onAction }: { settings: AdminSetting[]; roles: AdminRole[]; profiles: AdminProfile[]; onAction: (work: () => Promise<unknown>, success: string) => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(settings.map(item => [item.key, JSON.stringify(item.value, null, 2)])))
  const promoteTarget = (userId: string) => onAction(() => setAdminRole(userId, 'admin', { manageUsers: true, moderateContent: true }, askReason('Role admin concedida')), 'Role administrativa aplicada.')
  return <section className="admin-list"><SectionHeading title="Configurações SaaS" detail={`${settings.length} chaves · ${roles.length} admins`} /><div className="admin-settings-grid"><article className="admin-panel"><div className="admin-section-heading"><span><Settings2 size={16} /> Platform settings</span><small>JSON auditado</small></div><div className="admin-actions admin-actions--settings"><button className="button button--secondary button--compact" onClick={() => onAction(() => cleanupExpiredVerificationEvidence(askReason('Limpeza de evidências expiradas')), 'Limpeza de evidências executada.')}><Trash2 size={14} /> Limpar evidências expiradas</button></div>{settings.map(item => <label className="field admin-json-field" key={item.key}><span>{item.key}</span><textarea rows={7} value={drafts[item.key] ?? JSON.stringify(item.value, null, 2)} onChange={event => setDrafts(current => ({ ...current, [item.key]: event.target.value }))} /><small>Atualizado por @{item.updated_by_username ?? 'sistema'} · {formatRelativeDate(item.updated_at)}</small><button className="button button--primary button--compact" onClick={() => onAction(() => updateAdminSetting(item.key, JSON.parse(drafts[item.key] ?? '{}') as Record<string, unknown>, askReason(`Atualização de ${item.key}`)), 'Configuração salva.')}><Save size={14} /> Salvar {item.key}</button></label>)}</article><article className="admin-panel"><div className="admin-section-heading"><span><UserCog size={16} /> Roles administrativos</span><small>Base granular</small></div><div className="admin-role-list">{roles.map(role => <div className="admin-role-card" key={role.user_id}><Avatar name={role.display_name || role.username} src={role.avatar_url} /><span><strong>{role.display_name || role.username}</strong><small>@{role.username} · {role.role}</small></span><code>{JSON.stringify(role.permissions)}</code></div>)}</div><label className="field"><span>Promover usuário carregado a admin</span><select onChange={event => { if (event.target.value) void promoteTarget(event.target.value); event.currentTarget.value = '' }} defaultValue=""><option value="">Selecionar perfil</option>{profiles.filter(item => !roles.some(role => role.user_id === item.id)).map(item => <option key={item.id} value={item.id}>@{item.username}</option>)}</select><small>Cria role admin com permissões iniciais e auditoria.</small></label></article></div></section>
}

function DetailDrawer({ drawer, onClose }: { drawer: NonNullable<DrawerState>; onClose: () => void }) {
  return <div className="admin-drawer-backdrop" role="presentation" onClick={onClose}><aside className="admin-drawer" role="dialog" aria-modal="true" aria-label={drawer.title} onClick={event => event.stopPropagation()}><header><div><span className="eyebrow"><Eye size={14} /> DETALHE OPERACIONAL</span><h2>{drawer.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Fechar detalhe"><X size={18} /></button></header><pre>{JSON.stringify(drawer.payload, null, 2)}</pre></aside></div>
}