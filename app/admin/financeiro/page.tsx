"use client";

import { useState, useEffect, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/layout/PageHeader";

// ── Tipos ──────────────────────────────────────────
interface FinanceUser {
  id: string;
  name: string;
  email: string;
  tipo: string;
}
interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string;
  status: string;
  payment_status: string;
  multa_aplicada: boolean;
  position: number | null;
  users: FinanceUser | null;
}
interface GameRow {
  id: string;
  game_date: string;
  total_players: number | null;
  total_arrecadado: number | null;
}

// ── Constantes ─────────────────────────────────────
const VALOR_MENSALISTA = 50;
const VALOR_AVULSO = 30;
const MULTA_PERCENTUAL = 0.2;

// ── Helpers ────────────────────────────────────────
function formatCurrency(v: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v || 0);
}
function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

// ── Hook de dados ──────────────────────────────────
function useFinanceiroData() {
  const [jogadores, setJogadores] = useState<GamePlayer[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [semanaAtual, setSemanaAtual] = useState<GameRow | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .order("game_date", { ascending: false })
        .limit(8);
      const latestGame = gamesData?.[0];
      setSemanaAtual((latestGame as GameRow | null) ?? null);
      setGames((gamesData as GameRow[] | null) ?? []);
      if (!latestGame) {
        setJogadores([]);
        setLoading(false);
        return;
      }

      const { data: playersData } = await supabase
        .from("game_players")
        .select("*, users (id, name, email, tipo)")
        .eq("game_id", latestGame.id)
        .order("position", { ascending: true });

      const norm =
        (
          playersData as
            | (Omit<GamePlayer, "users"> & {
                users: FinanceUser | FinanceUser[] | null;
              })[]
            | null
        )?.map((j) => ({
          ...j,
          users: Array.isArray(j.users) ? (j.users[0] ?? null) : j.users,
        })) ?? [];
      setJogadores(norm);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function togglePagamento(gpId: string, statusAtual: string) {
    await supabase
      .from("game_players")
      .update({ payment_status: statusAtual === "pago" ? "pendente" : "pago" })
      .eq("id", gpId);
    fetchData();
  }

  async function toggleMulta(gpId: string, multaAtual: boolean) {
    await supabase
      .from("game_players")
      .update({ multa_aplicada: !multaAtual })
      .eq("id", gpId);
    fetchData();
  }

  useEffect(() => {
    fetchData();
  }, []);

  const confirmados = jogadores.filter((j) => j.status === "confirmado");
  const totalEsperado = confirmados.reduce((acc, j) => {
    const base =
      j.users?.tipo === "mensalista" ? VALOR_MENSALISTA : VALOR_AVULSO;
    return acc + base + (j.multa_aplicada ? base * MULTA_PERCENTUAL : 0);
  }, 0);
  const totalArrecadado = confirmados
    .filter((j) => j.payment_status === "pago")
    .reduce((acc, j) => {
      const base =
        j.users?.tipo === "mensalista" ? VALOR_MENSALISTA : VALOR_AVULSO;
      return acc + base + (j.multa_aplicada ? base * MULTA_PERCENTUAL : 0);
    }, 0);
  const totalPendente = totalEsperado - totalArrecadado;
  const totalMultas = confirmados
    .filter((j) => j.multa_aplicada)
    .reduce((acc, j) => {
      const base =
        j.users?.tipo === "mensalista" ? VALOR_MENSALISTA : VALOR_AVULSO;
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

// ── Sub-componentes ────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  color: "green" | "red" | "blue" | "yellow";
}) {
  const cfg = {
    green: {
      wrap: "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40",
      text: "text-green-700 dark:text-green-400",
    },
    red: {
      wrap: "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40",
      text: "text-red-700 dark:text-red-400",
    },
    blue: {
      wrap: "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/40",
      text: "text-blue-700 dark:text-blue-400",
    },
    yellow: {
      wrap: "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/40",
      text: "text-yellow-700 dark:text-yellow-400",
    },
  }[color];
  return (
    <div
      className={`rounded-2xl border p-4 relative overflow-hidden ${cfg.wrap}`}
    >
      <div className="absolute -right-3 -top-3 text-5xl opacity-10">{icon}</div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </p>
      <p className={`font-display text-2xl leading-none ${cfg.text}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function Badge({
  children,
  color,
}: {
  children: ReactNode;
  color: "green" | "red" | "yellow" | "blue" | "gray";
}) {
  const cfg = {
    green:
      "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30",
    red: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30",
    yellow:
      "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/30",
    blue: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30",
    gray: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  }[color];
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg}`}
    >
      {children}
    </span>
  );
}

// ── Página principal ───────────────────────────────
export default function FinanceiroPainel() {
  const {
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

  const [filtro, setFiltro] = useState<"todos" | "pago" | "pendente" | "multa">(
    "todos",
  );

  const jogadoresFiltrados = confirmados.filter((j) => {
    if (filtro === "pendente") return j.payment_status !== "pago";
    if (filtro === "pago") return j.payment_status === "pago";
    if (filtro === "multa") return j.multa_aplicada;
    return true;
  });

  const pctArrecadado =
    totalEsperado > 0 ? Math.round((totalArrecadado / totalEsperado) * 100) : 0;

  return (
    <div className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-950">
      <PageHeader
        title="FINANCEIRO"
        subtitle="Painel administrativo"
        showBack
        rightSlot={
          <button
            onClick={fetchData}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white active:scale-95 transition-all"
          >
            🔄
          </button>
        }
      />

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* ── Banner semana atual ── */}
        {semanaAtual && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
            <span className="text-2xl">📅</span>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">
                Semana atual
              </p>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                Partida de {formatDate(semanaAtual.game_date)}
                <span className="ml-2 text-gray-400 font-normal">
                  · {confirmados.length} confirmados
                </span>
              </p>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
              />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ── Cards de stats ── */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Arrecadado"
                value={formatCurrency(totalArrecadado)}
                sub={`${pagoCount} jogador(es)`}
                icon="💰"
                color="green"
              />
              <StatCard
                label="Pendente"
                value={formatCurrency(totalPendente)}
                sub={`${pendCount} jogador(es)`}
                icon="⏳"
                color="red"
              />
              <StatCard
                label="Esperado"
                value={formatCurrency(totalEsperado)}
                sub={`${pctArrecadado}% recebido`}
                icon="🎯"
                color="blue"
              />
              <StatCard
                label="Multas"
                value={formatCurrency(totalMultas)}
                sub={`${multaCount} avulso(s)`}
                icon="⚠️"
                color="yellow"
              />
            </div>

            {/* ── Barra de progresso ── */}
            <div className="rounded-2xl p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Progresso de arrecadação</span>
                <span
                  className={`font-bold ${
                    pctArrecadado >= 80
                      ? "text-green-600 dark:text-green-400"
                      : pctArrecadado >= 50
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {pctArrecadado}%
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    pctArrecadado >= 80
                      ? "bg-gradient-to-r from-green-500 to-green-400"
                      : pctArrecadado >= 50
                        ? "bg-gradient-to-r from-yellow-500 to-yellow-400"
                        : "bg-gradient-to-r from-red-500 to-red-400"
                  }`}
                  style={{ width: `${pctArrecadado}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-2">
                <span>{formatCurrency(totalArrecadado)} recebido</span>
                <span>Meta: {formatCurrency(totalEsperado)}</span>
              </div>
            </div>

            {/* ── Filtros ── */}
            <div className="flex rounded-xl p-1 gap-1 bg-gray-200 dark:bg-gray-800">
              {(
                [
                  { key: "todos", label: `Todos (${confirmados.length})` },
                  { key: "pago", label: `✅ Pagos (${pagoCount})` },
                  { key: "pendente", label: `⏳ Pend. (${pendCount})` },
                  { key: "multa", label: `⚠️ Multas (${multaCount})` },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFiltro(key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                    filtro === key
                      ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-400 dark:text-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Lista de jogadores ── */}
            <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Jogadores
                </p>
                <p className="text-xs text-gray-400">
                  {jogadoresFiltrados.length} resultado(s)
                </p>
              </div>

              {jogadoresFiltrados.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-sm">
                    Nenhum jogador para este filtro.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
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
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          !isPago ? "border-l-2 border-l-red-400" : ""
                        }`}
                      >
                        {/* Número */}
                        <span className="text-gray-400 text-xs w-5 text-center flex-shrink-0">
                          {idx + 1}
                        </span>

                        {/* Avatar */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm uppercase text-white flex-shrink-0 ${
                            isPago
                              ? "bg-gradient-to-br from-green-500 to-green-600"
                              : "bg-gradient-to-br from-gray-400 to-gray-500"
                          }`}
                        >
                          {(j.users?.name || "?")[0].toUpperCase()}
                        </div>

                        {/* Nome + badges */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {j.users?.name || "Jogador"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge
                              color={tipo === "mensalista" ? "blue" : "gray"}
                            >
                              {tipo === "mensalista" ? "📅 Mens." : "💳 Avulso"}
                            </Badge>
                            {j.multa_aplicada && (
                              <Badge color="yellow">+20% multa</Badge>
                            )}
                          </div>
                        </div>

                        {/* Valor */}
                        <div className="text-right flex-shrink-0 hidden sm:block">
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            {formatCurrency(total)}
                          </p>
                          {j.multa_aplicada && (
                            <p className="text-yellow-600 dark:text-yellow-400 text-xs">
                              {formatCurrency(base)} + {formatCurrency(multa)}
                            </p>
                          )}
                        </div>

                        {/* Toggle pagamento */}
                        <button
                          onClick={() =>
                            togglePagamento(j.id, j.payment_status)
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 flex-shrink-0 ${
                            isPago
                              ? "bg-green-100 dark:bg-green-900/20 border-green-200 dark:border-green-800/40 text-green-700 dark:text-green-400"
                              : "bg-red-100 dark:bg-red-900/20 border-red-200 dark:border-red-800/40 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {isPago ? "✅ Pago" : "⏳ Pend."}
                        </button>

                        {/* Toggle multa — só avulso */}
                        {tipo !== "mensalista" && (
                          <button
                            onClick={() => toggleMulta(j.id, j.multa_aplicada)}
                            title={
                              j.multa_aplicada
                                ? "Remover multa"
                                : "Aplicar multa 20%"
                            }
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm border transition-all active:scale-95 flex-shrink-0 ${
                              j.multa_aplicada
                                ? "bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-40 hover:opacity-100"
                            }`}
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

            {/* ── Histórico de partidas ── */}
            <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Histórico · últimas 8 semanas
                </p>
              </div>
              {games.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  Nenhuma partida encontrada.
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {games.map((g, i) => (
                    <div
                      key={g.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span className="text-gray-400 text-xs w-5 text-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">
                          {formatDate(g.game_date)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {g.total_players || "—"} jogadores
                        </p>
                      </div>
                      <p className="font-bold text-sm text-green-600 dark:text-green-400 flex-shrink-0">
                        {formatCurrency(g.total_arrecadado)}
                      </p>
                      <Badge color={i === 0 ? "green" : "gray"}>
                        {i === 0 ? "Atual" : "Encerrada"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
