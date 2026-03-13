"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";

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
    <div className="min-h-screen pb-28 bg-gray-50 dark:bg-gray-950">
      {/* ── Header ── */}
      <header className="sticky top-0 z-40 px-4 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 active:scale-95 transition-all"
          >
            ←
          </button>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest">
              Futebol Lar Cristão
            </p>
            <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
              REGULAMENTO
            </h1>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-4 py-4 space-y-4 max-w-md mx-auto">
        {/* ── Tabs ── */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "jogo", label: "⚽ Regras do Jogo" },
              { key: "pagamento", label: "💰 Pagamentos" },
            ] as { key: Aba; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setAba(tab.key);
                setAberto(null);
              }}
              className={`py-3 rounded-xl text-sm font-semibold transition-all border ${
                aba === tab.key
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Accordion ── */}
        <div className="space-y-2">
          {regras.map((regra, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden"
            >
              <button
                onClick={() => setAberto(aberto === i ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <span className="text-xl flex-shrink-0">{regra.icon}</span>
                <p className="flex-1 font-semibold text-gray-900 dark:text-white text-sm">
                  {regra.titulo}
                </p>
                <span
                  className={`text-gray-400 text-xs transition-transform duration-200 ${aberto === i ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>

              {aberto === i && (
                <div className="px-4 pb-4">
                  <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
                    <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                      {regra.descricao}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Rodapé ── */}
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 text-center">
          <p className="text-gray-400 text-xs">
            Dúvidas? Fale com o administrador do grupo.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
