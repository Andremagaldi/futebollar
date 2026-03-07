"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import { sortearTimes } from "@/lib/sortearTimes";
import PageHeader from "@/components/layout/PageHeader";
import BottomNav from "@/components/layout/BottomNav";

type Player = {
  id: string;
  nome_completo: string;
  estrelas: number;
  posicao: string;
};

type PlayerRow = {
  user_id: string;
  users:
    | { nome_completo: string; posicao: string; stars: number }
    | { nome_completo: string; posicao: string; stars: number }[]
    | null;
};

type Time = {
  nome: string;
  jogadores: Player[];
};

const TIME_CONFIGS = [
  {
    border: "border-blue-200 dark:border-blue-800/50",
    header: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
    avatar: "bg-gradient-to-br from-blue-500 to-blue-700",
    stripe: "bg-blue-600",
    emoji: "🔵",
  },
  {
    border: "border-red-200 dark:border-red-800/50",
    header: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-600 dark:text-red-400",
    avatar: "bg-gradient-to-br from-red-500 to-red-700",
    stripe: "bg-red-600",
    emoji: "🔴",
  },
  {
    border: "border-green-200 dark:border-green-800/50",
    header: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-600 dark:text-green-400",
    avatar: "bg-gradient-to-br from-green-500 to-green-700",
    stripe: "bg-green-600",
    emoji: "🟢",
  },
  {
    border: "border-yellow-200 dark:border-yellow-700/50",
    header: "bg-yellow-50 dark:bg-yellow-900/20",
    text: "text-yellow-600 dark:text-yellow-400",
    avatar: "bg-gradient-to-br from-yellow-400 to-yellow-600",
    stripe: "bg-yellow-500",
    emoji: "🟡",
  },
];

export default function SorteioPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [sorteioConfirmado, setSorteioConfirmado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: games } = await supabase
      .from("games")
      .select("*")
      .order("data_jogo", { ascending: false })
      .limit(1);

    if (!games || games.length === 0) {
      setLoading(false);
      return;
    }

    const game = games[0];
    setGameId(game.id);
    setSorteioConfirmado(game.sorteio_confirmado);

    // Verificar admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("users")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      if (profile?.is_admin) setIsAdmin(true);
    }

    if (game.sorteio_confirmado) {
      // Buscar times oficiais
      const { data: oficiais } = await supabase
        .from("times_sorteados")
        .select(`user_id, nome_time, users (nome_completo, posicao, stars)`)
        .eq("game_id", game.id);

      const agrupados: Record<string, Player[]> = {};
      oficiais?.forEach((item: any) => {
        if (!agrupados[item.nome_time]) agrupados[item.nome_time] = [];
        agrupados[item.nome_time].push({
          id: item.user_id ?? crypto.randomUUID(),
          nome_completo: item.users?.nome_completo ?? "Jogador",
          posicao: item.users?.posicao ?? "linha",
          estrelas: item.users?.stars ?? 0,
        });
      });
      setTimes(
        Object.keys(agrupados).map((nome) => ({
          nome,
          jogadores: agrupados[nome],
        })),
      );
    } else {
      // Buscar confirmados para sortear
      const { data: jogadores } = await supabase
        .from("game_players")
        .select(`user_id, users (nome_completo, posicao, stars)`)
        .eq("game_id", game.id)
        .eq("status", "confirmado");

      const normalizados =
        (jogadores as PlayerRow[] | null)?.map((p) => ({
          id: p.user_id,
          nome_completo: Array.isArray(p.users)
            ? (p.users[0]?.nome_completo ?? "Jogador")
            : (p.users?.nome_completo ?? "Jogador"),
          posicao: Array.isArray(p.users)
            ? (p.users[0]?.posicao ?? "linha")
            : (p.users?.posicao ?? "linha"),
          estrelas: Array.isArray(p.users)
            ? (p.users[0]?.stars ?? 0)
            : (p.users?.stars ?? 0),
        })) ?? [];
      setPlayers(normalizados);
    }

    setLoading(false);
  }

  function handleSortear() {
    if (players.length === 0) return;
    setTimes(sortearTimes(players));
  }

  async function handleConfirmar() {
    if (!gameId) return;
    setConfirmando(true);
    await supabase.from("times_sorteados").delete().eq("game_id", gameId);
    for (const time of times) {
      for (const jogador of time.jogadores) {
        await supabase.from("times_sorteados").insert({
          game_id: gameId,
          nome_time: time.nome,
          user_id: jogador.id,
        });
      }
    }
    await supabase
      .from("games")
      .update({ sorteio_confirmado: true })
      .eq("id", gameId);
    setConfirmando(false);
    setSorteioConfirmado(true);
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-950">
        <PageHeader
          title="SORTEIO"
          subtitle={
            sorteioConfirmado
              ? "Times oficiais confirmados"
              : "Sorteio de times"
          }
        />

        {/* ── Loading ── */}
        {loading && (
          <div className="px-4 pt-6 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-52 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
              />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ── Status banner ── */}
            <div className="px-4 pt-4 pb-2">
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
                  sorteioConfirmado
                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40"
                    : times.length > 0
                      ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/40"
                      : "bg-gray-100 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700"
                }`}
              >
                <span className="text-2xl flex-shrink-0">
                  {sorteioConfirmado ? "✅" : times.length > 0 ? "👀" : "🎲"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">
                    {sorteioConfirmado
                      ? "Sorteio confirmado oficialmente!"
                      : times.length > 0
                        ? "Preview gerado — aguardando confirmação"
                        : `${players.length} jogadores confirmados`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {sorteioConfirmado
                      ? "Os times abaixo são os oficiais do jogo"
                      : times.length > 0
                        ? isAdmin
                          ? "Revise e confirme para oficializar"
                          : "O admin ainda não confirmou"
                        : "Toque em Gerar Sorteio para sortear os times"}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Botões de ação ── */}
            {!sorteioConfirmado && (
              <div className="px-4 pb-4 flex gap-3">
                <button
                  onClick={handleSortear}
                  disabled={players.length === 0}
                  className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {times.length > 0 ? "🔀 Regerar Sorteio" : "🎲 Gerar Sorteio"}
                </button>

                {isAdmin && times.length > 0 && (
                  <button
                    onClick={handleConfirmar}
                    disabled={confirmando}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-green-600 to-green-800 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {confirmando ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Confirmando...
                      </span>
                    ) : (
                      "✅ Confirmar Oficial"
                    )}
                  </button>
                )}
              </div>
            )}

            {/* ── Sem jogadores, sem times ── */}
            {times.length === 0 && players.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <p className="text-6xl mb-4">📋</p>
                <p className="font-display text-2xl text-gray-900 dark:text-white mb-2">
                  LISTA VAZIA
                </p>
                <p className="text-sm text-gray-400">
                  Nenhum jogador confirmado neste jogo ainda.
                </p>
              </div>
            )}

            {/* ── Grid de times ── */}
            {times.length > 0 && (
              <div
                className={`px-4 grid gap-3 ${times.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}
              >
                {times.map((time, idx) => {
                  const cfg = TIME_CONFIGS[idx % TIME_CONFIGS.length];
                  const goleiros = time.jogadores.filter(
                    (j) => j.posicao === "goleiro",
                  );
                  const linha = time.jogadores.filter(
                    (j) => j.posicao !== "goleiro",
                  );

                  return (
                    <div
                      key={time.nome}
                      className={`rounded-2xl overflow-hidden border shadow-sm bg-white dark:bg-gray-900 ${cfg.border}`}
                    >
                      {/* Header do time */}
                      <div
                        className={`px-4 py-3 flex items-center gap-2 ${cfg.header}`}
                      >
                        <span className="text-lg">{cfg.emoji}</span>
                        <span
                          className={`font-display text-lg tracking-wide ${cfg.text}`}
                        >
                          {time.nome}
                        </span>
                        <span className="ml-auto text-xs text-gray-400">
                          {time.jogadores.length} jog.
                        </span>
                      </div>

                      {/* Jogadores */}
                      <div className="p-2 space-y-1">
                        {goleiros.map((j) => (
                          <div
                            key={j.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-yellow-50 dark:bg-yellow-900/10"
                          >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold uppercase bg-gradient-to-br from-yellow-400 to-yellow-600 text-white flex-shrink-0">
                              {j.nome_completo.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
                              {j.nome_completo.split(" ")[0]}
                            </span>
                            <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold flex-shrink-0">
                              🧤
                            </span>
                          </div>
                        ))}

                        {linha.map((j, i) => (
                          <div
                            key={j.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-xl ${
                              i % 2 === 0
                                ? "bg-gray-50 dark:bg-gray-800/50"
                                : ""
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold uppercase text-white flex-shrink-0 ${cfg.avatar}`}
                            >
                              {j.nome_completo.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
                              {j.nome_completo.split(" ")[0]}
                            </span>
                            {j.estrelas > 0 && (
                              <span className="text-[10px] text-yellow-500 flex-shrink-0">
                                {"★".repeat(Math.min(j.estrelas, 3))}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
