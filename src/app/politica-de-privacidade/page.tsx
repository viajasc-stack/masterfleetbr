import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade | MasterFleetBR",
  description: "Política de Privacidade da plataforma MasterFleetBR.",
};

const atualizadoEm = "12/03/2026";

export default function PoliticaDePrivacidadePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">
          ← Voltar para o site
        </Link>

        <h1 className="text-3xl font-bold mt-4">Política de Privacidade — MasterFleetBR</h1>
        <p className="text-sm text-slate-400 mt-2">Última atualização: {atualizadoEm}</p>

        <div className="mt-8 space-y-8 text-sm leading-7 text-slate-200">
          <section>
            <h2 className="text-xl font-semibold text-white">1. Introdução</h2>
            <p>
              Esta Política de Privacidade descreve como o MasterFleetBR coleta, utiliza, armazena e protege dados
              pessoais e dados operacionais no contexto da prestação de serviços de software de gestão para empresas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">2. Dados Coletados</h2>
            <p>Podemos tratar, entre outros, os seguintes dados:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>dados cadastrais da empresa e de usuários autorizados;</li>
              <li>dados de autenticação e segurança (login, sessões e permissões);</li>
              <li>dados operacionais inseridos no sistema (agenda, ordens, contratos, veículos, motoristas, financeiro);</li>
              <li>dados técnicos de uso, telemetria, logs de auditoria e diagnóstico;</li>
              <li>dados oriundos de integrações autorizadas com terceiros (ex.: Google Agenda).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">3. Finalidades de Tratamento</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>viabilizar o funcionamento da plataforma e seus módulos contratados;</li>
              <li>autenticar usuários, controlar acesso e prevenir fraudes;</li>
              <li>oferecer suporte técnico, manutenção e evolução do produto;</li>
              <li>cumprir obrigações legais, regulatórias e contratuais;</li>
              <li>permitir integrações e automações autorizadas pelo cliente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">4. Bases Legais (LGPD)</h2>
            <p>
              O tratamento de dados pode ocorrer com base em: execução de contrato, cumprimento de obrigação legal,
              legítimo interesse, exercício regular de direitos e/ou consentimento, conforme aplicável ao caso concreto.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">5. Compartilhamento de Dados</h2>
            <p>O MasterFleetBR pode compartilhar dados com:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>provedores de infraestrutura e serviços essenciais para operação da plataforma;</li>
              <li>parceiros de integração solicitados pelo cliente;</li>
              <li>autoridades públicas, quando houver obrigação legal ou ordem válida.</li>
            </ul>
            <p className="mt-2">Não comercializamos dados pessoais.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">6. Segurança da Informação</h2>
            <p>
              Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados contra acesso não autorizado,
              destruição, perda, alteração, comunicação ou difusão indevida, incluindo controle de acesso, segregação de
              ambiente e mecanismos de auditoria.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">7. Retenção e Exclusão</h2>
            <p>
              Os dados são mantidos pelo período necessário para as finalidades previstas nesta Política, cumprimento de
              obrigações legais, defesa de direitos e execução contratual. Sempre que possível e aplicável, dados podem
              ser anonimizados ou excluídos mediante solicitação válida.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">8. Direitos dos Titulares</h2>
            <p>Nos termos da LGPD, o titular pode solicitar, quando aplicável:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>confirmação da existência de tratamento e acesso aos dados;</li>
              <li>correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>portabilidade, informação sobre compartilhamento e revisão de decisões automatizadas;</li>
              <li>revogação de consentimento, quando esta for a base legal utilizada.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">9. Cookies e Tecnologias Semelhantes</h2>
            <p>
              Podemos utilizar cookies e tecnologias semelhantes para autenticação, segurança, performance e melhoria da
              experiência do usuário. O uso pode variar conforme navegador e preferências do usuário.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">10. Transferência Internacional</h2>
            <p>
              Dependendo da infraestrutura e dos serviços de terceiros contratados, alguns dados podem ser processados em
              servidores localizados fora do Brasil, sempre com salvaguardas adequadas e observância da legislação.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">11. Alterações desta Política</h2>
            <p>
              Esta Política pode ser atualizada periodicamente. A versão vigente será publicada nesta página, com data de
              atualização, para ciência de clientes e usuários.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">12. Contato</h2>
            <p>
              Para solicitações relativas à privacidade e proteção de dados, utilize os canais oficiais de suporte do
              MasterFleetBR.
            </p>
            <p className="mt-2">
              Consulte também os <Link className="text-emerald-400 hover:text-emerald-300" href="/termos-de-servico">Termos de Serviço</Link>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
