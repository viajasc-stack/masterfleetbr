import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type KPI = { label: string; value: string };
type Feature = { icon: string; title: string; desc: string };
type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  highlight?: boolean;
  ctaLabel: string;
  ctaHref: string;
  features: string[];
};

type LandingContent = {
  brand: { name: string; tagline: string };
  hero: {
    badge: string;
    title: string;
    highlight: string;
    subtitle: string;
    primaryCtaLabel: string;
    primaryCtaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    trustNote: string;
  };
  kpis: KPI[];
  featuresTitle: string;
  features: Feature[];
  proofTitle: string;
  proofItems: string[];
  plansTitle: string;
  plansSubtitle: string;
  plans: Plan[];
  finalCta: {
    title: string;
    subtitle: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
};

type SalesModule = {
  title: string;
  subtitle: string;
  details: string[];
};

const SALES_MODULES: SalesModule[] = [
  {
    title: "Operação diária centralizada",
    subtitle: "Dashboard + ordens + contratos + clientes",
    details: [
      "Visão executiva com indicadores de OS, contratos e operação em andamento.",
      "Gestão completa de ordens de serviço desde abertura até conclusão.",
      "Cadastro de clientes, passageiros, veículos e motoristas com histórico consolidado.",
    ],
  },
  {
    title: "Manutenção + Oficina profissional",
    subtitle: "Triagem de manutenção e execução técnica segregada",
    details: [
      "Módulo de manutenção focado em solicitações, preventivas, planos e indicadores.",
      "Módulo de oficina para execução operacional das ordens e acompanhamento técnico.",
      "Separação clara entre operação técnica e controle financeiro por módulo.",
    ],
  },
  {
    title: "Inventário e suprimentos",
    subtitle: "Controle de itens, entradas, saídas e compras",
    details: [
      "Gestão de estoque por categorias, locais e movimentações.",
      "Rastreio de entradas/saídas e apoio ao planejamento de reposição.",
      "Integração com processos de manutenção e oficina para consumo operacional.",
    ],
  },
  {
    title: "Financeiro e faturamento",
    subtitle: "Contas, assinatura e saúde financeira",
    details: [
      "Contas a pagar e receber com visão prática para tomada de decisão.",
      "Acompanhamento de assinatura e configurações de pagamento por empresa.",
      "Base para previsibilidade de caixa e governança financeira.",
    ],
  },
  {
    title: "Agenda, viagens e fretamento",
    subtitle: "Planejamento operacional sem ruído",
    details: [
      "Organização de agenda e viagens com foco em execução diária.",
      "Apoio a fluxos de fretamento eventual e recorrente.",
      "Menos conflito operacional e mais previsibilidade de entrega.",
    ],
  },
  {
    title: "Expansão comercial",
    subtitle: "Central de negócios + suporte + governança master",
    details: [
      "Central de negócios para ampliar oportunidades entre empresas.",
      "Suporte estruturado para reduzir atrito na operação.",
      "Painel master com configurações globais, módulos, planos e segurança.",
    ],
  },
];

const SALES_STEPS = [
  { title: "1. Captação", desc: "Entrada de clientes, contratos e demandas operacionais." },
  { title: "2. Planejamento", desc: "Agenda, viagens, equipe e frota organizadas em fluxo único." },
  { title: "3. Execução", desc: "OS, manutenção e oficina com rastreabilidade ponta a ponta." },
  { title: "4. Controle", desc: "Financeiro, indicadores e governança para decisões rápidas." },
  { title: "5. Escala", desc: "Central de negócios, módulos avançados e crescimento sustentável." },
];

const FAQ_ITEMS = [
  {
    q: "Serve para empresas pequenas e grandes?",
    a: "Sim. Você pode começar com operação essencial e evoluir com módulos conforme sua empresa cresce.",
  },
  {
    q: "Dá para adaptar ao meu processo atual?",
    a: "Sim. O sistema permite configuração por módulo, estrutura de operação e parâmetros por empresa.",
  },
  {
    q: "Consigo centralizar tudo em um único lugar?",
    a: "Esse é o objetivo do MasterFleetBR: unir operação, manutenção, oficina, estoque, financeiro e gestão.",
  },
  {
    q: "A implantação é rápida?",
    a: "Sim. A proposta é acelerar entrada em produção com setup guiado e evolução contínua sem retrabalho.",
  },
];

const FALLBACK_CONTENT: LandingContent = {
  brand: {
    name: "MasterFleetBR",
    tagline: "Gestão completa para empresas de transporte de passageiros",
  },
  hero: {
    badge: "SaaS #1 para frotas de turismo e fretamento",
    title: "A plataforma que organiza sua operação ponta a ponta",
    highlight: "e acelera o lucro da sua empresa",
    subtitle:
      "Una ordens de serviço, contratos, agenda, financeiro, manutenção, inventário e suporte em um único sistema pensado para o transporte de passageiros.",
    primaryCtaLabel: "Começar teste grátis",
    primaryCtaHref: "/cadastro",
    secondaryCtaLabel: "Entrar no sistema",
    secondaryCtaHref: "/login",
    trustNote: "Sem cartão de crédito. Implantação rápida e suporte especializado.",
  },
  kpis: [
    { label: "Módulos integrados", value: "10+" },
    { label: "Tempo ganho na operação", value: "até 40%" },
    { label: "Visão em tempo real", value: "24/7" },
  ],
  featuresTitle: "Tudo que sua empresa precisa para crescer com controle",
  features: [
    { icon: "🧾", title: "Ordens de Serviço e Orçamentos", desc: "Fluxo completo de abertura, execução, aprovação e histórico com rastreabilidade total." },
    { icon: "🗓️", title: "Agenda Operacional", desc: "Programação centralizada de serviços, equipes e veículos para reduzir conflitos e atrasos." },
    { icon: "🚌", title: "Frota, Veículos e Motoristas", desc: "Cadastro completo, documentos, vínculo de condutor e visão operacional da frota." },
    { icon: "🛠️", title: "Manutenção Inteligente", desc: "Preventivas e corretivas com controle de custos para evitar paradas inesperadas." },
    { icon: "📦", title: "Inventário e Entradas", desc: "Estoque com movimentações, fornecedores e alertas para não faltar item crítico." },
    { icon: "💳", title: "Financeiro e Assinatura", desc: "Contas a pagar/receber, visão de caixa e cobrança centralizada em um único painel." },
    { icon: "📈", title: "Relatórios de Gestão", desc: "Indicadores para tomada de decisão com foco em eficiência operacional e margem." },
  ],
  proofTitle: "Por que o MasterFleetBR vende mais e opera melhor?",
  proofItems: [
    "Processos padronizados: menos retrabalho e menos erro humano.",
    "Informação centralizada: decisões mais rápidas para diretoria e operação.",
    "Atendimento mais ágil: módulo de suporte integrado entre empresa e master.",
    "Escalabilidade: comece pequeno e evolua sem trocar de sistema.",
  ],
  plansTitle: "Planos para cada fase do seu crescimento",
  plansSubtitle: "Comece no plano ideal e evolua conforme sua operação expande.",
  plans: [
    {
      name: "Starter",
      price: "R$ 99",
      period: "/mês",
      description: "Para iniciar com organização e controle básico.",
      highlight: false,
      ctaLabel: "Começar grátis",
      ctaHref: "/cadastro",
      features: ["OS e clientes", "Veículos e motoristas", "Financeiro essencial"],
    },
    {
      name: "Profissional",
      price: "R$ 199",
      period: "/mês",
      description: "Mais vendido para operações em crescimento.",
      highlight: true,
      ctaLabel: "Começar grátis",
      ctaHref: "/cadastro",
      features: ["Tudo do Starter", "Inventário completo", "Contratos recorrentes", "Relatórios avançados"],
    },
    {
      name: "Enterprise",
      price: "Sob consulta",
      period: "",
      description: "Para empresas com alta escala e necessidades especiais.",
      highlight: false,
      ctaLabel: "Falar com vendas",
      ctaHref: "/cadastro",
      features: ["Tudo do Profissional", "Configurações avançadas", "Suporte prioritário", "Acompanhamento dedicado"],
    },
  ],
  finalCta: {
    title: "Pronto para transformar sua operação?",
    subtitle: "Ative seu teste grátis e veja na prática como o MasterFleetBR simplifica sua gestão.",
    primaryLabel: "Quero testar agora",
    primaryHref: "/cadastro",
    secondaryLabel: "Já sou cliente",
    secondaryHref: "/login",
  },
};

async function getLandingContent(): Promise<LandingContent> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return FALLBACK_CONTENT;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("site_landing_content")
    .select("data")
    .eq("slug", "home")
    .maybeSingle();

  if (error || !data?.data) return FALLBACK_CONTENT;

  return { ...FALLBACK_CONTENT, ...(data.data as Partial<LandingContent>) };
}

export default async function HomePage() {
  const content = await getLandingContent();

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-emerald-500/30">
      <header className="border-b border-slate-800/60 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div>
          <span className="font-bold text-lg">{content.brand.name}</span>
          <span className="ml-2 text-xs text-slate-500">{content.brand.tagline}</span>
        </div>
        <div className="flex gap-3">
          <Link href={content.hero.secondaryCtaHref} className="text-sm text-slate-400 hover:text-white transition px-3 py-1.5">
            {content.hero.secondaryCtaLabel}
          </Link>
          <Link href={content.hero.primaryCtaHref} className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition">
            {content.hero.primaryCtaLabel}
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-block text-xs font-semibold tracking-widest text-emerald-400 uppercase border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 rounded-full mb-6">
          {content.hero.badge}
        </div>
        <h1 className="text-5xl font-bold leading-tight">
          {content.hero.title}<br />
          <span className="text-emerald-400">{content.hero.highlight}</span>
        </h1>
        <p className="mt-6 text-xl text-slate-400 max-w-2xl mx-auto">
          {content.hero.subtitle}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={content.hero.primaryCtaHref}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold hover:bg-emerald-500 transition">
            {content.hero.primaryCtaLabel}
          </Link>
          <Link href={content.hero.secondaryCtaHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-300 hover:bg-slate-800 transition">
            {content.hero.secondaryCtaLabel}
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-600">{content.hero.trustNote}</p>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {content.kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-2xl font-bold text-emerald-400">{kpi.value}</div>
              <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide">{kpi.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-3xl font-bold text-center mb-4">Portal de vendas com contexto real da sua operação</h2>
        <p className="text-center text-slate-400 mb-12 max-w-3xl mx-auto">
          Estruturamos o MasterFleetBR para vender valor de negócio: menos retrabalho, mais controle e crescimento com previsibilidade.
          Abaixo está uma visão detalhada das frentes que sua equipe consegue dominar em uma única plataforma.
        </p>
        <div className="grid lg:grid-cols-2 gap-6">
          {SALES_MODULES.map((module) => (
            <div key={module.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-lg font-semibold text-white">{module.title}</h3>
              <p className="text-sm text-emerald-400 mt-1">{module.subtitle}</p>
              <ul className="mt-4 space-y-2">
                {module.details.map((detail) => (
                  <li key={detail} className="text-sm text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-3xl font-bold text-center mb-4">Como o sistema transforma operação em resultado</h2>
        <p className="text-center text-slate-400 mb-12">Um fluxo único do comercial ao pós-serviço para reduzir ruído e aumentar margem.</p>
        <div className="grid md:grid-cols-5 gap-4">
          {SALES_STEPS.map((step) => (
            <div key={step.title} className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
              <div className="text-emerald-400 text-sm font-semibold">{step.title}</div>
              <div className="text-sm text-slate-300 mt-2">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-3xl font-bold text-center mb-12">{content.featuresTitle}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 hover:border-slate-700 transition">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-3xl font-bold text-center mb-10">{content.proofTitle}</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {content.proofItems.map((item) => (
            <div key={item} className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-4 text-slate-300 text-sm">
              <span className="text-emerald-400 mr-2">✓</span>
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-3xl font-bold text-center mb-10">Perguntas frequentes</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
              <h3 className="font-semibold text-white">{item.q}</h3>
              <p className="text-sm text-slate-400 mt-2">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-3xl font-bold text-center mb-4">{content.plansTitle}</h2>
        <p className="text-center text-slate-400 mb-12">{content.plansSubtitle}</p>
        <div className="grid sm:grid-cols-3 gap-6">
          {content.plans.map((p) => (
            <div key={p.name} className={`rounded-2xl border p-7 flex flex-col ${p.highlight ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20" : "border-slate-800 bg-slate-900/40"}`}>
              {p.highlight && <div className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">Mais popular</div>}
              <div className="text-xl font-bold text-white">{p.name}</div>
              <div className="text-3xl font-bold mt-2">{p.price}<span className="text-base font-normal text-slate-400">{p.period}</span></div>
              <div className="text-sm text-slate-500 mt-1 mb-5">{p.description}</div>
              <ul className="space-y-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-sm text-slate-300 flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href={p.ctaHref}
                className={`mt-6 block text-center py-2.5 rounded-lg text-sm font-semibold transition ${p.highlight ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "border border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
                {p.ctaLabel}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-slate-800 text-center">
        <h2 className="text-4xl font-bold">{content.finalCta.title}</h2>
        <p className="text-slate-400 mt-4 max-w-2xl mx-auto">{content.finalCta.subtitle}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={content.finalCta.primaryHref}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold hover:bg-emerald-500 transition">
            {content.finalCta.primaryLabel}
          </Link>
          <Link href={content.finalCta.secondaryHref}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-300 hover:bg-slate-800 transition">
            {content.finalCta.secondaryLabel}
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-10 text-center text-sm text-slate-600">
        <p>© {new Date().getFullYear()} MasterFleetBR. Todos os direitos reservados.</p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <Link href="/termos-de-servico" className="hover:text-slate-400 transition">
            Termos de Serviço
          </Link>
          <span>•</span>
          <Link href="/politica-de-privacidade" className="hover:text-slate-400 transition">
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
