"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import PageHeader from "@/components/layout/PageHeader";
import BottomNav from "@/components/layout/BottomNav";

interface Jogador {
  id: string;
  nome_completo: string;
  posicao: string;
  votos: number;
}

export default function VotacaoPage() {
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [meuVoto, setMeuVoto] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [podeVotar, setPodeVotar] = useState(false);
  const [encerrado, setEncerrado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [votando, setVotando] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);

    // Usuário logado
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    // Último jogo
    const { data: games } = await supabase
      .from("games")
      .select("id, votacao_encerrada")
      .order("data_jogo", { ascending: false })
      .limit(1);

    if (!games || games.length === 0) {
      setLoading(false);
      return;
    }
    const game = games[0];
    setGameId(game.id);
    setEncerrado(game.votacao_encerrada ?? false);

    // Verificar se o usuário está confirmado na partida
    const { data: minhaEntrada } = await supabase
      .from("game_players")
      .select("id")
      .eq("game_id", game.id)
      .eq("user_id", user.id)
      .eq("status", "confirmado")
      .maybeSingle();

    setPodeVotar(!!minhaEntrada);

    // Buscar todos os confirmados
    const { data: players } = await supabase
      .from("game_players")
      .select(
        "user_id, users!game_players_user_id_fkey (nome_completo, posicao)",
      )
      .eq("game_id", game.id)
      .eq("status", "confirmado");

    // Buscar todos os votos da partida
    const { data: votos } = await supabase
      .from("mvp_votes")
      .select("voted_for")
      .eq("game_id", game.id);

    // Contar votos por jogador
    const votosMap: Record<string, number> = {};
    (votos ?? []).forEach((v: any) => {
      votosMap[v.voted_for] = (votosMap[v.voted_for] ?? 0) + 1;
    });

    // Verificar meu voto
    const { data: meuVotoData } = await supabase
      .from("mvp_votes")
      .select("voted_for")
      .eq("game_id", game.id)
      .eq("voter_id", user.id)
      .maybeSingle();

    if (meuVotoData) setMeuVoto(meuVotoData.voted_for);

    // Montar lista de jogadores com contagem de votos
    const lista: Jogador[] = (players ?? [])
      .map((p: any) => {
        const users = Array.isArray(p.users) ? p.users[0] : p.users;
        return {
          id: p.user_id,
          nome_completo: users?.nome_completo ?? "Jogador",
          posicao: users?.posicao ?? "linha",
          votos: votosMap[p.user_id] ?? 0,
        };
      })
      .sort((a, b) => b.votos - a.votos);

    setJogadores(lista);
    setLoading(false);
  }

  async function handleVotar(votadoId: string) {
    if (!podeVotar || meuVoto || encerrado || votando) return;
    // Não pode votar em si mesmo
    if (votadoId === userId) return;

    setVotando(true);
    const { error } = await supabase.from("mvp_votes").insert({
      game_id: gameId,
      voter_id: userId,
      voted_for: votadoId,
    });

    if (error) {
      alert("Erro ao registrar voto: " + error.message);
    } else {
      setMeuVoto(votadoId);
      // Atualiza contagem local sem refetch
      setJogadores((prev) =>
        [
          ...prev.map((j) =>
            j.id === votadoId ? { ...j, votos: j.votos + 1 } : j,
          ),
        ].sort((a, b) => b.votos - a.votos),
      );
    }
    setVotando(false);
  }

  const totalVotos = jogadores.reduce((s, j) => s + j.votos, 0);
  const mostrarResultado = !!meuVoto || encerrado;

  return (
    <ProtectedRoute>
      <div className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-950">
        <PageHeader title="VOTAÇÃO MVP" subtitle="Melhor jogador da partida" />

        {/* ── Loading ── */}
        {loading && (
          <div className="px-4 pt-6 space-y-3">
            <div className="h-20 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
              />
            ))}
          </div>
        )}

        {!loading && (
          <>
            {/* ── Banner de status ── */}
            <div className="px-4 pt-4 pb-3">
              {encerrado ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">
                      Votação encerrada
                    </p>
                    <p className="text-xs text-gray-400">
                      Confira o resultado final abaixo
                    </p>
                  </div>
                </div>
              ) : meuVoto ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                  <span className="text-2xl">✅</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">
                      Voto registrado!
                    </p>
                    <p className="text-xs text-gray-400">
                      Acompanhe o resultado em tempo real
                    </p>
                  </div>
                </div>
              ) : !podeVotar ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/40">
                  <span className="text-2xl">👀</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">
                      Apenas espectador
                    </p>
                    <p className="text-xs text-gray-400">
                      Só jogadores confirmados na partida podem votar
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/40">
                  <span className="text-2xl">🏅</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">
                      Quem foi o melhor?
                    </p>
                    <p className="text-xs text-gray-400">
                      Toque em um jogador para votar · 1 voto por pessoa
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Sem jogadores ── */}
            {jogadores.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <p className="text-5xl mb-4">📋</p>
                <p className="font-display text-2xl text-gray-900 dark:text-white mb-2">
                  SEM PARTIDA ATIVA
                </p>
                <p className="text-sm text-gray-400">
                  Nenhum jogo com jogadores confirmados encontrado.
                </p>
              </div>
            )}

            {/* ── Lista de jogadores ── */}
            <div className="px-4 space-y-2">
              {jogadores.map((j, idx) => {
                const isLider = idx === 0 && j.votos > 0;
                const isMeuVoto = meuVoto === j.id;
                const isSelf = j.id === userId;
                const pct = totalVotos > 0 ? (j.votos / totalVotos) * 100 : 0;
                const clicavel = podeVotar && !meuVoto && !encerrado && !isSelf;

                return (
                  <button
                    key={j.id}
                    onClick={() => handleVotar(j.id)}
                    disabled={!clicavel || votando}
                    className={`w-full rounded-2xl overflow-hidden text-left transition-all active:scale-[0.98] disabled:cursor-default border shadow-sm ${
                      isMeuVoto
                        ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-400 dark:border-yellow-700 shadow-[0_0_0_2px_rgba(201,150,10,0.2)]"
                        : isLider
                          ? "bg-white dark:bg-gray-900 border-yellow-200 dark:border-yellow-800/40"
                          : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                    } ${clicavel ? "hover:border-blue-300 dark:hover:border-blue-700" : ""}`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {/* Posição / medalha */}
                      <span className="text-lg w-8 text-center flex-shrink-0">
                        {isLider
                          ? "👑"
                          : idx < 3 && j.votos > 0
                            ? ["🥇", "🥈", "🥉"][idx]
                            : `#${idx + 1}`}
                      </span>

                      {/* Avatar */}
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm uppercase text-white flex-shrink-0 ${
                          isMeuVoto
                            ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                            : isLider
                              ? "bg-gradient-to-br from-yellow-500 to-orange-500"
                              : "bg-gradient-to-br from-blue-500 to-blue-700"
                        }`}
                      >
                        {j.nome_completo.charAt(0)}
                      </div>

                      {/* Nome + barra de progresso */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {j.nome_completo}
                          </p>
                          {isMeuVoto && (
                            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium flex-shrink-0">
                              ← meu voto
                            </span>
                          )}
                          {isSelf && (
                            <span className="text-xs text-gray-400 flex-shrink-0">
                              ← você
                            </span>
                          )}
                        </div>

                        {/* Barra de resultado (só após votar ou encerrado) */}
                        {mostrarResultado && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  isMeuVoto
                                    ? "bg-gradient-to-r from-yellow-400 to-yellow-600"
                                    : isLider
                                      ? "bg-gradient-to-r from-orange-400 to-yellow-500"
                                      : "bg-gradient-to-r from-blue-400 to-blue-600"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-gray-400 w-8 text-right flex-shrink-0">
                              {Math.round(pct)}%
                            </span>
                          </div>
                        )}

                        <p className="text-xs text-gray-400 mt-0.5">
                          {j.posicao === "goleiro" ? "🧤 Goleiro" : "⚽ Linha"}
                        </p>
                      </div>

                      {/* Contador de votos */}
                      <div className="flex-shrink-0 text-right pl-1">
                        <p
                          className={`font-display text-xl leading-none ${
                            isLider
                              ? "text-yellow-500"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {j.votos}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {j.votos === 1 ? "voto" : "votos"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Total de votos ── */}
            {jogadores.length > 0 && (
              <div className="px-4 mt-4 mb-2 text-center">
                <p className="text-xs text-gray-400">
                  {totalVotos}{" "}
                  {totalVotos === 1 ? "voto registrado" : "votos registrados"}{" "}
                  no total
                </p>
              </div>
            )}
          </>
        )}

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
