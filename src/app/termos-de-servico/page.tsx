import Link from "next/link";

export const metadata = {
  title: "Termos de Serviço | MasterFleetBR",
  description: "Termos de Serviço da plataforma MasterFleetBR.",
};

const atualizadoEm = "12/03/2026";

export default function TermosDeServicoPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">
          ← Voltar para o site
        </Link>

        <h1 className="text-3xl font-bold mt-4">Termos de Serviço — MasterFleetBR</h1>
        <p className="text-sm text-slate-400 mt-2">Última atualização: {atualizadoEm}</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Aceitação dos Termos</h2>
            <p>
              Estes Termos de Serviço regulam o uso da plataforma MasterFleetBR. Ao se cadastrar, acessar ou utilizar o
              sistema, você declara que leu, compreendeu e concorda com estes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Objeto do Serviço</h2>
            <p>
              O MasterFleetBR é um software de gestão para empresas de transporte e operações correlatas, incluindo,
              entre outros recursos: agenda operacional, ordens de serviço, contratos, gestão de frota, motoristas,
              abastecimentos, manutenção, financeiro, inventário e integrações com serviços de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. Cadastro e Responsabilidade da Conta</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>O cliente é responsável pela veracidade dos dados informados no cadastro.</li>
              <li>O cliente é responsável pela guarda das credenciais de acesso de seus usuários.</li>
              <li>Qualquer atividade realizada na conta da empresa será de responsabilidade do cliente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Planos, Cobrança e Cancelamento</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>O uso da plataforma pode estar sujeito a planos, limites e funcionalidades contratadas.</li>
              <li>Valores, periodicidade e condições comerciais seguem a oferta vigente no momento da contratação.</li>
              <li>O cancelamento pode ser solicitado pelo cliente conforme regras comerciais aplicáveis ao plano.</li>
              <li>Inadimplência pode resultar em suspensão ou limitação de acesso, conforme legislação aplicável.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Uso Aceitável</h2>
            <p>É proibido utilizar o MasterFleetBR para:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>atividades ilícitas, fraudulentas ou que violem direitos de terceiros;</li>
              <li>tentativas de acesso não autorizado, engenharia reversa ou exploração de vulnerabilidades;</li>
              <li>inserção de conteúdo malicioso (vírus, scripts nocivos, automações abusivas).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Integrações com Terceiros</h2>
            <p>
              O MasterFleetBR pode integrar com serviços de terceiros (como Google, gateways de pagamento e APIs
              externas). O uso dessas integrações depende da disponibilidade e das políticas dos respectivos provedores.
              Eventuais interrupções, alterações de API ou indisponibilidades de terceiros podem impactar funcionalidades
              integradas, sem caracterizar descumprimento contratual do MasterFleetBR.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Propriedade Intelectual</h2>
            <p>
              Todo o software, identidade visual, marca, código-fonte, estrutura de dados e conteúdos da plataforma são
              protegidos por direitos de propriedade intelectual. Estes Termos não transferem ao cliente qualquer direito
              de titularidade sobre a plataforma, exceto licença de uso limitada ao período contratual.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. Privacidade e Proteção de Dados</h2>
            <p>
              O tratamento de dados pessoais segue a Política de Privacidade do MasterFleetBR e a legislação aplicável,
              incluindo a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
            </p>
            <p className="mt-2">
              Consulte: <Link className="text-emerald-400 hover:text-emerald-300" href="/politica-de-privacidade">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">9. Limitação de Responsabilidade</h2>
            <p>
              Na máxima extensão permitida por lei, o MasterFleetBR não se responsabiliza por danos indiretos, lucros
              cessantes, perda de oportunidade, indisponibilidades ocasionadas por terceiros, falhas de conectividade,
              erro de operação do usuário ou uso em desacordo com estes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">10. Suporte e Contato</h2>
            <p>
              Para dúvidas, solicitações ou suporte, utilize os canais oficiais da plataforma. Sempre que necessário,
              poderá ser exigida validação de identidade e vínculo com a empresa contratante.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">11. Alterações destes Termos</h2>
            <p>
              O MasterFleetBR poderá atualizar estes Termos periodicamente para refletir melhorias de produto,
              exigências legais ou mudanças operacionais. A versão vigente estará sempre disponível nesta página, com
              indicação da data de atualização.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">12. Foro e Lei Aplicável</h2>
            <p>
              Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca do prestador do serviço,
              com renúncia a qualquer outro, por mais privilegiado que seja, salvo disposição legal em contrário.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
