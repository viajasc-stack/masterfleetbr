import Link from "next/link";

const FEATURES = [
  { icon: "📋", title: "Ordens de Serviço", desc: "Gerencie OS com numeração automática, status em tempo real e histórico completo." },
  { icon: "🚌", title: "Gestão de Frota", desc: "Controle veículos, motoristas e manutenções preventivas da sua frota." },
  { icon: "📦", title: "Controle de Estoque", desc: "Inventário com entradas, movimentos, saldos e alertas de estoque mínimo." },
  { icon: "💰", title: "Financeiro", desc: "Contas a pagar e receber, vencimentos e saldo projetado sempre visíveis." },
  { icon: "📄", title: "Contratos Recorrentes", desc: "Geração automática de OS a partir de contratos com horários fixos." },
  { icon: "📊", title: "Relatórios", desc: "Análise de OS por período, cliente e veículo para decisões baseadas em dados." },
];

const PLANOS = [
  { nome: "Starter", preco: "R$ 99", desc: "Até 2 usuários", features: ["OS ilimitadas", "Clientes e frota", "Financeiro básico"] },
  { nome: "Profissional", preco: "R$ 199", destaque: true, desc: "Até 10 usuários", features: ["Tudo do Starter", "Inventário completo", "Contratos recorrentes", "Relatórios avançados"] },
  { nome: "Enterprise", preco: "Sob consulta", desc: "Usuários ilimitados", features: ["Tudo do Profissional", "API de integração", "Suporte dedicado", "SLA garantido"] },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-slate-800/60 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div>
          <span className="font-bold text-lg">MasterFleetBR</span>
          <span className="ml-2 text-xs text-slate-500">by TransTech</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="text-sm text-slate-400 hover:text-white transition px-3 py-1.5">
            Entrar
          </Link>
          <Link href="/cadastro" className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition">
            Teste grátis
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-block text-xs font-semibold tracking-widest text-emerald-400 uppercase border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 rounded-full mb-6">
          SaaS para transporte de passageiros
        </div>
        <h1 className="text-5xl font-bold leading-tight">
          Gerencie sua frota com<br />
          <span className="text-emerald-400">inteligência e agilidade</span>
        </h1>
        <p className="mt-6 text-xl text-slate-400 max-w-2xl mx-auto">
          Sistema completo para empresas de turismo, fretamento e transporte corporativo. 
          OS, frota, motoristas, estoque e financeiro em um só lugar.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/cadastro"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-8 py-3.5 text-base font-semibold hover:bg-emerald-500 transition">
            Começar grátis por 7 dias
          </Link>
          <Link href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-300 hover:bg-slate-800 transition">
            Já tenho conta
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-600">Sem cartão de crédito. Cancele quando quiser.</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-3xl font-bold text-center mb-12">Tudo que sua operação precisa</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 hover:border-slate-700 transition">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16 border-t border-slate-800">
        <h2 className="text-3xl font-bold text-center mb-4">Planos simples e transparentes</h2>
        <p className="text-center text-slate-400 mb-12">Comece de graça. Escale conforme cresce.</p>
        <div className="grid sm:grid-cols-3 gap-6">
          {PLANOS.map((p) => (
            <div key={p.nome} className={`rounded-2xl border p-7 flex flex-col ${p.destaque ? "border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20" : "border-slate-800 bg-slate-900/40"}`}>
              {p.destaque && <div className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">Mais popular</div>}
              <div className="text-xl font-bold text-white">{p.nome}</div>
              <div className="text-3xl font-bold mt-2">{p.preco}<span className="text-base font-normal text-slate-400">{p.preco !== "Sob consulta" ? "/mês" : ""}</span></div>
              <div className="text-sm text-slate-500 mt-1 mb-5">{p.desc}</div>
              <ul className="space-y-2 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="text-sm text-slate-300 flex items-center gap-2">
                    <span className="text-emerald-400">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/cadastro"
                className={`mt-6 block text-center py-2.5 rounded-lg text-sm font-semibold transition ${p.destaque ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "border border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
                {p.preco === "Sob consulta" ? "Falar com vendas" : "Começar grátis"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-800 py-10 text-center text-sm text-slate-600">
        <p>© {new Date().getFullYear()} MasterFleetBR. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
