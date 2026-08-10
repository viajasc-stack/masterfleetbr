import { Check, Crown, EyeOff, LockKeyhole, MessageCircle, Search, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { LovixAppContext } from '../../app-context'
import { formatPrice } from '../../lib/format'
import { getActivePremiumPlan } from '../../services/premium.service'
import type { SubscriptionPlan } from '../../types'

const benefits = [
  { icon: MessageCircle, title: 'Mensagens privadas', description: 'Inicie conversas com quem despertou seu interesse.' },
  { icon: Search, title: 'Descoberta avançada', description: 'Mais contexto para encontrar perfis compatíveis.' },
  { icon: EyeOff, title: 'Mais discrição', description: 'Controle sua presença com preferências de privacidade.' },
  { icon: ShieldCheck, title: 'Comunidade segura', description: 'Ferramentas de bloqueio, denúncia e moderação.' },
]

export function PremiumPage() {
  const { profile } = useOutletContext<LovixAppContext>()
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null)

  useEffect(() => {
    getActivePremiumPlan().then(setPlan).catch(() => toast.error('Não foi possível carregar o plano Premium.'))
  }, [])

  return (
    <div className="page page--premium">
      <section className="premium-hero">
        <div className="premium-hero__orb" />
        <span className="premium-emblem"><Crown size={22} /></span>
        <span className="eyebrow eyebrow--light"><Sparkles size={14} /> LOVIX PREMIUM</span>
        <h1>Mais liberdade para criar conexões do seu jeito.</h1>
        <p>Desbloqueie mensagens privadas, recursos de descoberta e controles extras para viver a comunidade com mais intenção.</p>
        {profile.is_premium ? <div className="premium-active"><Check size={18} /> Seu Premium está ativo{profile.premium_until ? ` até ${new Intl.DateTimeFormat('pt-BR').format(new Date(profile.premium_until))}` : ''}.</div> : <button className="button button--light" onClick={() => toast('A integração PIX será ativada após configurar as credenciais do Mercado Pago nas Edge Functions.')}>Assinar Premium {plan ? `por ${formatPrice(plan.price_cents)}/mês` : ''}</button>}
      </section>
      <section className="premium-benefits"><header><span className="eyebrow">O QUE MUDA</span><h2>Feito para conexões mais conscientes.</h2></header><div>{benefits.map(({ icon: Icon, title, description }) => <article key={title}><span><Icon size={22} /></span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
      <section className="premium-plan-card"><div><span className="eyebrow">PLANO ATUAL</span><h2>{plan?.name ?? 'Premium mensal'}</h2><p>{plan?.description ?? 'Recursos exclusivos para a sua experiência LOVIX.'}</p></div><div className="premium-plan-card__price"><strong>{plan ? formatPrice(plan.price_cents) : 'R$ 19,90'}</strong><span>por mês</span></div><ul><li><Check size={16} /> Sem anúncios internos</li><li><Check size={16} /> Cancele quando quiser</li><li><Check size={16} /> Pagamento protegido via PIX</li></ul></section>
      <p className="premium-legal"><LockKeyhole size={14} /> A cobrança por PIX será processada em ambiente seguro. Nenhuma chave de pagamento fica exposta no navegador.</p>
    </div>
  )
}