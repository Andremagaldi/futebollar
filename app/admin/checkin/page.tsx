"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface Jogador {
  id: string;
  user_id: string;
  nome: string;
  posicao: string;
  tipo: string;
  checkin_feito: boolean;
  checkin_em: string | null;
  ordem_chegada: number | null;
}

export default function CheckinPage() {
  const router = useRouter();
  const { isAdmin, userId, loading: roleLoading } = useRole();

  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [loading, setLoading] = useState(true);
  const [fazendoCheckin, setFazendoCheckin] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [jaMarcou, setJaMarcou] = useState(false);
  const [dataJogo, setDataJogo] = useState("");

  useEffect(() => {
    if (!roleLoading) init();
  }, [roleLoading]);

  // ── Realtime ──────────────────────────────────────
  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel("checkin-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "game_players",
          filter: `game_id=eq.${gameId}`,
        },
        () => loadJogadores(gameId),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  async function init() {
    setLoading(true);

    const { data: game } = await supabase
      .from("games")
      .select("id, data_jogo")
      .order("data_jogo", { ascending: false })
      .limit(1)
      .single();

    if (!game) {
      setLoading(false);
      return;
    }

    setGameId(game.id);
    setDataJogo(
      new Date(game.data_jogo + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    );

    await loadJogadores(game.id);
    setLoading(false);
  }

  async function loadJogadores(gid: string) {
    const { data } = await supabase
      .from("game_players")
      .select(
        "id, user_id, posicao, tipo, checkin_feito, checkin_em, ordem_chegada, users(nome_completo)",
      )
      .eq("game_id", gid)
      .eq("status", "confirmado")
      .order("ordem_chegada", { ascending: true, nullsFirst: false });

    if (!data) return;

    const lista: Jogador[] = data.map((d: any) => ({
      id: d.id,
      user_id: d.user_id,
      nome: d.users?.nome_completo ?? "—",
      posicao: d.posicao,
      tipo: d.tipo,
      checkin_feito: d.checkin_feito,
      checkin_em: d.checkin_em,
      ordem_chegada: d.ordem_chegada,
    }));

    setJogadores(lista);
    if (userId) {
      setJaMarcou(
        lista.find((j) => j.user_id === userId)?.checkin_feito ?? false,
      );
    }
  }

  async function fazerCheckin() {
    if (!gameId || !userId || fazendoCheckin) return;
    setFazendoCheckin(true);
    await supabase.rpc("fazer_checkin", {
      p_game_id: gameId,
      p_user_id: userId,
    });
    setJaMarcou(true);
    await loadJogadores(gameId);
    setFazendoCheckin(false);
  }

  async function confirmarCheckinAdmin(jogadorUserId: string) {
    if (!gameId || !isAdmin) return;
    setLoadingId(jogadorUserId);
    await supabase.rpc("fazer_checkin", {
      p_game_id: gameId,
      p_user_id: jogadorUserId,
    });
    await loadJogadores(gameId);
    setLoadingId(null);
  }

  async function cancelarCheckin(jogadorUserId: string) {
    if (!gameId || !isAdmin) return;
    setLoadingId(jogadorUserId);
    await supabase.rpc("cancelar_checkin", {
      p_game_id: gameId,
      p_user_id: jogadorUserId,
    });
    await loadJogadores(gameId);
    setLoadingId(null);
  }

  const chegaram = jogadores
    .filter((j) => j.checkin_feito)
    .sort((a, b) => (a.ordem_chegada ?? 999) - (b.ordem_chegada ?? 999));
  const aguardando = jogadores.filter((j) => !j.checkin_feito);
  const meuJogador = jogadores.find((j) => j.user_id === userId);
  const estouNaLista = !!meuJogador;
  const percentual =
    jogadores.length > 0
      ? Math.round((chegaram.length / jogadores.length) * 100)
      : 0;

  function badgeOrdem(ordem: number | null) {
    if (ordem === 1) return "bg-yellow-400 text-yellow-950";
    if (ordem === 2) return "bg-gray-300 text-gray-900";
    if (ordem === 3) return "bg-orange-600 text-orange-100";
    return "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400";
  }

  function formatHora(iso: string | null) {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <ProtectedRoute requiredRole="admin">
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
              <p className="text-xs text-yellow-500 uppercase tracking-widest font-semibold">
                Admin · Checkin
              </p>
              <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white capitalize">
                {dataJogo || "CHECKIN"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => gameId && loadJogadores(gameId)}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 active:scale-95 transition-all"
            >
              🔄
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
          {loading || roleLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : (
            <>
              {/* ── Cards contador ── */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl p-4 text-center bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30">
                  <p className="font-display text-3xl text-green-600 dark:text-green-400 leading-none">
                    {chegaram.length}
                  </p>
                  <p className="text-xs text-green-500 mt-1 uppercase tracking-wider">
                    Chegaram
                  </p>
                </div>
                <div className="rounded-2xl p-4 text-center bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                  <p className="font-display text-3xl text-gray-400 leading-none">
                    {aguardando.length}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                    Aguardando
                  </p>
                </div>
                <div className="rounded-2xl p-4 text-center bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                  <p className="font-display text-3xl text-blue-600 dark:text-blue-400 leading-none">
                    {percentual}%
                  </p>
                  <p className="text-xs text-blue-500 mt-1 uppercase tracking-wider">
                    Presença
                  </p>
                </div>
              </div>

              {/* ── Barra de progresso ── */}
              <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>Progresso</span>
                  <span>
                    {chegaram.length}/{jogadores.length}
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentual}%` }}
                  />
                </div>
              </div>

              {/* ── Botão checkin do próprio user (se admin também está na lista) ── */}
              {estouNaLista && (
                <div>
                  {jaMarcou ? (
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30">
                      <span className="text-3xl">✅</span>
                      <div>
                        <p className="font-semibold text-sm text-green-700 dark:text-green-400">
                          Sua presença confirmada!
                        </p>
                        <p className="text-xs text-green-500 mt-0.5">
                          {meuJogador?.ordem_chegada}º a chegar
                          {meuJogador?.checkin_em &&
                            ` · ${formatHora(meuJogador.checkin_em)}`}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={fazerCheckin}
                      disabled={fazendoCheckin}
                      className="w-full py-5 rounded-2xl bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white font-bold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                      {fazendoCheckin ? (
                        <>
                          <Spinner /> Registrando...
                        </>
                      ) : (
                        <>📍 Cheguei!</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* ── Já chegaram ── */}
              {chegaram.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-green-600 dark:text-green-500 mb-2 px-1">
                    ✅ Chegaram ({chegaram.length})
                  </p>
                  <div className="space-y-2">
                    {chegaram.map((j) => (
                      <div
                        key={j.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm"
                      >
                        {/* Badge ordem */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeOrdem(j.ordem_chegada)}`}
                        >
                          {j.ordem_chegada}º
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {j.nome}
                          </p>
                          <p className="text-xs text-gray-400">
                            {j.posicao === "goleiro"
                              ? "🧤 Goleiro"
                              : "⚽ Linha"}
                            {j.checkin_em && ` · ${formatHora(j.checkin_em)}`}
                          </p>
                        </div>
                        {/* Admin: cancelar */}
                        {isAdmin &&
                          (loadingId === j.user_id ? (
                            <Spinner />
                          ) : (
                            <button
                              onClick={() => cancelarCheckin(j.user_id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-95 text-sm"
                            >
                              ✕
                            </button>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Aguardando ── */}
              {aguardando.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
                    ⏳ Aguardando ({aguardando.length})
                  </p>
                  <div className="space-y-2">
                    {aguardando.map((j) => (
                      <div
                        key={j.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 opacity-60"
                      >
                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-400 text-xs font-bold">
                            —
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {j.nome}
                          </p>
                          <p className="text-xs text-gray-400">
                            {j.posicao === "goleiro"
                              ? "🧤 Goleiro"
                              : "⚽ Linha"}
                          </p>
                        </div>
                        {/* Admin: confirmar manualmente */}
                        {isAdmin &&
                          (loadingId === j.user_id ? (
                            <Spinner />
                          ) : (
                            <button
                              onClick={() => confirmarCheckinAdmin(j.user_id)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors active:scale-95 whitespace-nowrap opacity-100"
                            >
                              ✓ Chegou
                            </button>
                          ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Não está na lista ── */}
              {!estouNaLista && (
                <div className="rounded-2xl p-5 text-center bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Você não está na lista desta partida.
                  </p>
                </div>
              )}

              {/* ── Sem jogo ── */}
              {jogadores.length === 0 && !estouNaLista && (
                <div className="flex flex-col items-center py-16 text-center">
                  <p className="text-5xl mb-3">📅</p>
                  <p className="font-display text-xl text-gray-900 dark:text-white">
                    SEM PARTIDA ATIVA
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Nenhum jogo encontrado.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}
