"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── Supabase client ───────────────────────────────────────────────────────────
// Substitua pelas suas variáveis de ambiente
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ─── Constantes ────────────────────────────────────────────────────────────────
const VALOR_MENSALISTA = 50; // R$ por partida
const VALOR_AVULSO = 30; // R$ por partida
const MULTA_PERCENTUAL = 0.2; // 20%

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

// ─── Hook principal de dados ───────────────────────────────────────────────────
function useFinanceiroData() {
  const [jogadores, setJogadores] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [semanaAtual, setSemanaAtual] = useState(null);

  async function fetchData() {
    setLoading(true);
    try {
      // Busca o jogo mais recente (semana atual)
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .order("game_date", { ascending: false })
        .limit(8);

      const latestGame = gamesData?.[0];
      setSemanaAtual(latestGame);
      setGames(gamesData || []);

      if (!latestGame) {
        setJogadores([]);
        setLoading(false);
        return;
      }

      // Busca jogadores do jogo atual com info do usuário
      const { data: playersData } = await supabase
        .from("game_players")
        .select(
          `
          *,
          users (
            id,
            name,
            email,
            tipo
          )
        `,
        )
        .eq("game_id", latestGame.id)
        .order("position", { ascending: true });

      setJogadores(playersData || []);
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoading(false);
    }
  }

  async function togglePagamento(gamePlayerId, statusAtual) {
    const novoStatus = statusAtual === "pago" ? "pendente" : "pago";
    await supabase
      .from("game_players")
      .update({ payment_status: novoStatus })
      .eq("id", gamePlayerId);
    fetchData();
  }

  async function toggleMulta(gamePlayerId, multaAtual) {
    await supabase
      .from("game_players")
      .update({ multa_aplicada: !multaAtual })
      .eq("id", gamePlayerId);
    fetchData();
  }

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Cálculos financeiros ────────────────────────────────────────────────────
  const confirmados = jogadores.filter((j) => j.status === "confirmado");

  const totalEsperado = confirmados.reduce((acc, j) => {
    const tipo = j.users?.tipo;
    const base = tipo === "mensalista" ? VALOR_MENSALISTA : VALOR_AVULSO;
    const multa = j.multa_aplicada ? base * MULTA_PERCENTUAL : 0;
    return acc + base + multa;
  }, 0);

  const totalArrecadado = confirmados
    .filter((j) => j.payment_status === "pago")
    .reduce((acc, j) => {
      const tipo = j.users?.tipo;
      const base = tipo === "mensalista" ? VALOR_MENSALISTA : VALOR_AVULSO;
      const multa = j.multa_aplicada ? base * MULTA_PERCENTUAL : 0;
      return acc + base + multa;
    }, 0);

  const totalPendente = totalEsperado - totalArrecadado;
  const totalMultas = confirmados
    .filter((j) => j.multa_aplicada)
    .reduce((acc, j) => {
      const tipo = j.users?.tipo;
      const base = tipo === "mensalista" ? VALOR_MENSALISTA : VALOR_AVULSO;
      return acc + base * MULTA_PERCENTUAL;
    }, 0);

  const pagoCount = confirmados.filter(
    (j) => j.payment_status === "pago",
  ).length;
  const pendCount = confirmados.filter(
    (j) => j.payment_status !== "pago",
  ).length;
  const multaCount = confirmados.filter((j) => j.multa_aplicada).length;

  return {
    jogadores,
    confirmados,
    games,
    semanaAtual,
    loading,
    totalEsperado,
    totalArrecadado,
    totalPendente,
    totalMultas,
    pagoCount,
    pendCount,
    multaCount,
    togglePagamento,
    toggleMulta,
    fetchData,
  };
}

// ─── Componente Badge ──────────────────────────────────────────────────────────
function Badge({ children, color }) {
  const colors = {
    green: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
    red: "bg-red-500/20 text-red-300 border border-red-500/30",
    yellow: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    blue: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    gray: "bg-zinc-700/50 text-zinc-400 border border-zinc-600/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colors[color]}`}
    >
      {children}
    </span>
  );
}

// ─── Card de estatística ───────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, icon }) {
  const accents = {
    green:
      "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/30 text-red-400",
    yellow:
      "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400",
  };
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-5 ${accents[accent]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-widest mb-1">
            {label}
          </p>
          <p
            className={`text-2xl font-black ${accents[accent].split(" ").pop()}`}
          >
            {value}
          </p>
          {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
        </div>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
    </div>
  );
}

// ─── Barra de progresso ────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const colors = {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
  };
  return (
    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${colors[color]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function FinanceiroPainel() {
  const {
    jogadores,
    confirmados,
    games,
    semanaAtual,
    loading,
    totalEsperado,
    totalArrecadado,
    totalPendente,
    totalMultas,
    pagoCount,
    pendCount,
    multaCount,
    togglePagamento,
    toggleMulta,
    fetchData,
  } = useFinanceiroData();

  const [filtro, setFiltro] = useState("todos"); // todos | pendente | pago | multa
  const [semanaVis, setSemanaVis] = useState("atual"); // atual | historico

  const jogadoresFiltrados = confirmados.filter((j) => {
    if (filtro === "pendente") return j.payment_status !== "pago";
    if (filtro === "pago") return j.payment_status === "pago";
    if (filtro === "multa") return j.multa_aplicada;
    return true;
  });

  const pctArrecadado =
    totalEsperado > 0
      ? ((totalArrecadado / totalEsperado) * 100).toFixed(0)
      : 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Fonte */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .font-display { font-family: 'Syne', sans-serif; }
        .glow-green { box-shadow: 0 0 24px rgba(16,185,129,0.15); }
        .glow-red { box-shadow: 0 0 24px rgba(239,68,68,0.15); }
      `}</style>

      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-lg">
              ⚽
            </div>
            <div>
              <h1 className="font-display font-800 text-lg leading-none text-white">
                Lar Cristão
              </h1>
              <p className="text-zinc-500 text-xs">Painel Financeiro · Admin</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-sm transition-all"
          >
            🔄 Atualizar
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Semana atual */}
        {semanaAtual && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-zinc-400 text-xs uppercase tracking-widest">
                Semana atual
              </p>
              <p className="text-white font-semibold">
                Partida de {formatDate(semanaAtual.game_date)}
                <span className="ml-2 text-zinc-500 text-sm font-normal">
                  · {confirmados.length} jogadores confirmados
                </span>
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-20 text-zinc-500 text-sm animate-pulse">
            Carregando dados financeiros...
          </div>
        )}

        {!loading && (
          <>
            {/* Cards de estatísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Arrecadado"
                value={formatCurrency(totalArrecadado)}
                sub={`${pagoCount} jogador(es)`}
                accent="green"
                icon="💰"
              />
              <StatCard
                label="Pendente"
                value={formatCurrency(totalPendente)}
                sub={`${pendCount} jogador(es)`}
                accent="red"
                icon="⏳"
              />
              <StatCard
                label="Total Esperado"
                value={formatCurrency(totalEsperado)}
                sub={`${pctArrecadado}% recebido`}
                accent="blue"
                icon="🎯"
              />
              <StatCard
                label="Multas"
                value={formatCurrency(totalMultas)}
                sub={`${multaCount} avulso(s)`}
                accent="yellow"
                icon="⚠️"
              />
            </div>

            {/* Barra de progresso geral */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Progresso de arrecadação</span>
                <span className="text-emerald-400 font-bold">
                  {pctArrecadado}%
                </span>
              </div>
              <ProgressBar
                value={totalArrecadado}
                max={totalEsperado}
                color={
                  pctArrecadado >= 80
                    ? "green"
                    : pctArrecadado >= 50
                      ? "yellow"
                      : "red"
                }
              />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>{formatCurrency(totalArrecadado)} recebido</span>
                <span>Meta: {formatCurrency(totalEsperado)}</span>
              </div>
            </div>

            {/* Tabs de filtro */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "todos", label: "Todos", count: confirmados.length },
                { key: "pago", label: "✅ Pagos", count: pagoCount },
                { key: "pendente", label: "⏳ Pendentes", count: pendCount },
                { key: "multa", label: "⚠️ Multas", count: multaCount },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFiltro(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                    filtro === tab.key
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600"
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 text-xs opacity-60">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Tabela de jogadores */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="font-display font-bold text-white">
                  Lista de Jogadores
                </h2>
                <span className="text-zinc-500 text-sm">
                  {jogadoresFiltrados.length} resultado(s)
                </span>
              </div>

              {jogadoresFiltrados.length === 0 ? (
                <div className="text-center py-12 text-zinc-600 text-sm">
                  Nenhum jogador encontrado para este filtro.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {jogadoresFiltrados.map((j, idx) => {
                    const tipo = j.users?.tipo || "avulso";
                    const base =
                      tipo === "mensalista" ? VALOR_MENSALISTA : VALOR_AVULSO;
                    const multa = j.multa_aplicada
                      ? base * MULTA_PERCENTUAL
                      : 0;
                    const total = base + multa;
                    const isPago = j.payment_status === "pago";

                    return (
                      <div
                        key={j.id}
                        className={`flex items-center gap-4 px-5 py-4 hover:bg-zinc-800/40 transition-colors ${
                          isPago ? "" : "border-l-2 border-l-red-500/40"
                        }`}
                      >
                        {/* Posição */}
                        <span className="text-zinc-600 text-xs w-5 text-center">
                          {idx + 1}
                        </span>

                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0">
                          {(j.users?.name || "?")[0].toUpperCase()}
                        </div>

                        {/* Nome e tipo */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">
                            {j.users?.name || "Jogador"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              color={tipo === "mensalista" ? "blue" : "gray"}
                            >
                              {tipo}
                            </Badge>
                            {j.multa_aplicada && (
                              <Badge color="yellow">+20% multa</Badge>
                            )}
                          </div>
                        </div>

                        {/* Valor */}
                        <div className="text-right hidden sm:block">
                          <p className="text-white text-sm font-bold">
                            {formatCurrency(total)}
                          </p>
                          {j.multa_aplicada && (
                            <p className="text-amber-500 text-xs">
                              {formatCurrency(base)} + {formatCurrency(multa)}
                            </p>
                          )}
                        </div>

                        {/* Toggle pagamento */}
                        <button
                          onClick={() =>
                            togglePagamento(j.id, j.payment_status)
                          }
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            isPago
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30"
                              : "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
                          }`}
                        >
                          {isPago ? "✅ Pago" : "⏳ Pendente"}
                        </button>

                        {/* Toggle multa (apenas avulso) */}
                        {tipo === "avulso" && (
                          <button
                            onClick={() => toggleMulta(j.id, j.multa_aplicada)}
                            className={`px-2 py-1.5 rounded-lg text-xs border transition-all ${
                              j.multa_aplicada
                                ? "bg-amber-500/20 border-amber-500/40 text-amber-400 hover:bg-amber-500/30"
                                : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-amber-400"
                            }`}
                            title={
                              j.multa_aplicada
                                ? "Remover multa"
                                : "Aplicar multa 20%"
                            }
                          >
                            ⚠️
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Histórico de partidas */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h2 className="font-display font-bold text-white">
                  Histórico de Partidas
                </h2>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Últimas 8 semanas
                </p>
              </div>
              <div className="divide-y divide-zinc-800">
                {games.map((g, i) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-800/30 transition-colors"
                  >
                    <span className="text-zinc-600 text-xs w-5">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-white text-sm">
                        {formatDate(g.game_date)}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        {g.total_players || "—"} jogadores
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 text-sm font-bold">
                        {formatCurrency(g.total_arrecadado)}
                      </p>
                      <p className="text-zinc-600 text-xs">arrecadado</p>
                    </div>
                    <Badge color={i === 0 ? "green" : "gray"}>
                      {i === 0 ? "Atual" : "Encerrada"}
                    </Badge>
                  </div>
                ))}
                {games.length === 0 && (
                  <div className="text-center py-8 text-zinc-600 text-sm">
                    Nenhuma partida encontrada.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
