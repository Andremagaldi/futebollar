"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Aba = "jogo" | "pagamento";

const REGRAS_JOGO = [
  {
    icon: "⚽",
    titulo: "Limite de jogadores",
    descricao:
      "Cada partida permite no máximo 20 jogadores de linha. Goleiros não contam nesse limite.",
  },
  {
    icon: "🏆",
    titulo: "Prioridade na lista",
    descricao:
      "Mensalistas têm prioridade automática na abertura da lista semanal. Avulsos podem entrar nas vagas restantes.",
  },
  {
    icon: "⏳",
    titulo: "Lista de espera",
    descricao:
      "Se a lista estiver cheia, você entra automaticamente na fila de espera. Se alguém desistir, o primeiro da fila é promovido automaticamente.",
  },
  {
    icon: "📅",
    titulo: "Abertura da lista",
    descricao:
      "A lista de jogadores é aberta toda quinta-feira. Fique atento para garantir sua vaga!",
  },
  {
    icon: "🎽",
    titulo: "Sorteio dos times",
    descricao:
      "Os times são sorteados no sábado usando o sistema Snake Draft, que distribui os jogadores de forma equilibrada entre os times.",
  },
  {
    icon: "🧤",
    titulo: "Goleiros",
    descricao:
      "Goleiros são inscritos separadamente e não ocupam vagas de jogadores de linha. Podem participar sem restrição de limite.",
  },
  {
    icon: "🏅",
    titulo: "MVP da partida",
    descricao:
      "Após cada partida, os jogadores votam no melhor jogador. O MVP é exibido no telão e acumula pontos no ranking.",
  },
  {
    icon: "🚫",
    titulo: "Desistência",
    descricao:
      "Se precisar sair da lista, faça isso o quanto antes para liberar a vaga para outro jogador da fila de espera.",
  },
];

const REGRAS_PAGAMENTO = [
  {
    icon: "💰",
    titulo: "Prazo de pagamento",
    descricao:
      "O pagamento deve ser realizado até sexta-feira às 23h59. Pagamentos fora do prazo estão sujeitos a multa.",
  },
  {
    icon: "⚠️",
    titulo: "Multa por atraso",
    descricao:
      "Jogadores avulsos que não pagarem até sexta-feira às 23h59 recebem uma multa de 20% sobre o valor da partida.",
  },
  {
    icon: "🏦",
    titulo: "Forma de pagamento",
    descricao:
      "O pagamento é feito exclusivamente via PIX. Após o pagamento, envie o comprovante pelo app para confirmação automática.",
  },
  {
    icon: "📱",
    titulo: "Envio do comprovante",
    descricao:
      "Após realizar o PIX, acesse a tela de pagamento no app e envie a foto do comprovante. O sistema confirma automaticamente.",
  },
  {
    icon: "✅",
    titulo: "Confirmação do pagamento",
    descricao:
      "Comprovantes válidos são aprovados automaticamente pela IA. Em caso de dúvida, o admin confirma manualmente.",
  },
  {
    icon: "🎮",
    titulo: "Jogar com pagamento pendente",
    descricao:
      "É permitido jogar mesmo com pagamento pendente, porém a multa será aplicada automaticamente após o prazo.",
  },
  {
    icon: "💳",
    titulo: "Mensalistas",
    descricao:
      "Jogadores mensalistas têm o pagamento controlado mensalmente pelo administrador. Consulte o admin em caso de dúvidas.",
  },
  {
    icon: "❌",
    titulo: "Remoção por inadimplência",
    descricao:
      "Nenhum jogador é removido automaticamente por falta de pagamento. O controle financeiro é feito pelo administrador.",
  },
];

export default function RegrasPage() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("jogo");
  const [aberto, setAberto] = useState<number | null>(null);

  const regras = aba === "jogo" ? REGRAS_JOGO : REGRAS_PAGAMENTO;

  return (
    <div className="min-h-screen bg-green-950 text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-green-400 text-sm mb-3 flex items-center gap-1 hover:text-green-300"
          >
            ← Voltar
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-700 rounded-xl flex items-center justify-center text-xl">
              📋
            </div>
            <div>
              <h1 className="text-2xl font-bold">Regulamento</h1>
              <p className="text-green-400 text-sm">Futebol Lar Cristão</p>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          <button
            onClick={() => {
              setAba("jogo");
              setAberto(null);
            }}
            className={`py-3 rounded-xl text-sm font-semibold transition-colors border ${
              aba === "jogo"
                ? "bg-green-700 border-green-600 text-white"
                : "bg-green-900/30 border-green-800/40 text-green-400 hover:border-green-600"
            }`}
          >
            ⚽ Regras do Jogo
          </button>
          <button
            onClick={() => {
              setAba("pagamento");
              setAberto(null);
            }}
            className={`py-3 rounded-xl text-sm font-semibold transition-colors border ${
              aba === "pagamento"
                ? "bg-green-700 border-green-600 text-white"
                : "bg-green-900/30 border-green-800/40 text-green-400 hover:border-green-600"
            }`}
          >
            💰 Pagamentos
          </button>
        </div>

        {/* Lista de regras (accordion) */}
        <div className="space-y-2">
          {regras.map((regra, i) => (
            <div
              key={i}
              className="bg-green-900/40 border border-green-800/40 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setAberto(aberto === i ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-green-800/20 transition-colors"
              >
                <span className="text-xl flex-shrink-0">{regra.icon}</span>
                <p className="flex-1 font-medium text-white text-sm">
                  {regra.titulo}
                </p>
                <span
                  className={`text-green-500 text-xs transition-transform duration-200 ${aberto === i ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>

              {aberto === i && (
                <div className="px-4 pb-4 pt-0">
                  <div className="border-t border-green-800/40 pt-3">
                    <p className="text-green-300 text-sm leading-relaxed">
                      {regra.descricao}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Rodapé */}
        <div className="mt-8 bg-green-900/20 border border-green-900/40 rounded-2xl p-4 text-center">
          <p className="text-green-600 text-xs">
            Dúvidas? Fale com o administrador do grupo.
          </p>
        </div>
      </div>
    </div>
  );
}
