"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface Jogador {
  id: string; // game_player id
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
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [loading, setLoading] = useState(true);
  const [fazendoCheckin, setFazendoCheckin] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [jaMarcou, setJaMarcou] = useState(false);
  const [dataJogo, setDataJogo] = useState("");

  useEffect(() => {
    init();
  }, []);

  // Realtime — atualiza lista ao vivo
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setCurrentUserId(user.id);

    // Verifica se é admin
    const { data: userData } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    setIsAdmin(userData?.is_admin ?? false);

    // Busca jogo mais recente
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
      new Date(game.data_jogo).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    );

    await loadJogadores(game.id, user.id);
    setLoading(false);
  }

  async function loadJogadores(gid: string, uid?: string) {
    const { data } = await supabase
      .from("game_players")
      .select(
        "id, user_id, posicao, tipo, checkin_feito, checkin_em, ordem_chegada, users(nome_completo)",
      )
      .eq("game_id", gid)
      .eq("status", "confirmado")
      .order("ordem_chegada", { ascending: true, nullsFirst: false });

    if (!data) return;

    const lista = data.map((d) => ({
      id: d.id,
      user_id: d.user_id,
      nome: (d.users as any)?.nome_completo ?? "—",
      posicao: d.posicao,
      tipo: d.tipo,
      checkin_feito: d.checkin_feito,
      checkin_em: d.checkin_em,
      ordem_chegada: d.ordem_chegada,
    }));

    setJogadores(lista);

    const userId = uid ?? currentUserId;
    if (userId) {
      const meu = lista.find((j) => j.user_id === userId);
      setJaMarcou(meu?.checkin_feito ?? false);
    }
  }

  async function fazerCheckin() {
    if (!gameId || !currentUserId || fazendoCheckin) return;
    setFazendoCheckin(true);

    const { error } = await supabase.rpc("fazer_checkin", {
      p_game_id: gameId,
      p_user_id: currentUserId,
    });

    if (!error) {
      setJaMarcou(true);
      await loadJogadores(gameId);
    }
    setFazendoCheckin(false);
  }

  async function cancelarCheckin(userId: string) {
    if (!gameId || !isAdmin) return;
    await supabase.rpc("cancelar_checkin", {
      p_game_id: gameId,
      p_user_id: userId,
    });
    await loadJogadores(gameId);
  }

  async function confirmarCheckinAdmin(userId: string) {
    if (!gameId || !isAdmin) return;
    await supabase.rpc("fazer_checkin", {
      p_game_id: gameId,
      p_user_id: userId,
    });
    await loadJogadores(gameId);
  }

  const chegaram = jogadores
    .filter((j) => j.checkin_feito)
    .sort((a, b) => (a.ordem_chegada ?? 999) - (b.ordem_chegada ?? 999));
  const aguardando = jogadores.filter((j) => !j.checkin_feito);
  const meuJogador = jogadores.find((j) => j.user_id === currentUserId);
  const estouNaLista = !!meuJogador;

  if (loading) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold">Check-in</h1>
          <p className="text-green-400 text-sm capitalize mt-0.5">{dataJogo}</p>
        </div>

        {/* Contador */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-green-900/40 border border-green-700/40 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-green-300">
              {chegaram.length}
            </p>
            <p className="text-green-500 text-sm mt-1">Chegaram</p>
          </div>
          <div className="bg-green-900/20 border border-green-800/40 rounded-2xl p-4 text-center">
            <p className="text-3xl font-bold text-green-600">
              {aguardando.length}
            </p>
            <p className="text-green-600 text-sm mt-1">Aguardando</p>
          </div>
        </div>

        {/* Botão de check-in do próprio jogador */}
        {estouNaLista && (
          <div className="mb-6">
            {jaMarcou ? (
              <div className="bg-green-800/40 border border-green-600/50 rounded-2xl p-5 flex items-center gap-4">
                <span className="text-3xl">✅</span>
                <div>
                  <p className="font-semibold text-green-300">
                    Presença confirmada!
                  </p>
                  <p className="text-green-500 text-sm">
                    Você chegou em {meuJogador?.ordem_chegada}º lugar
                    {meuJogador?.checkin_em && (
                      <>
                        {" "}
                        ·{" "}
                        {new Date(meuJogador.checkin_em).toLocaleTimeString(
                          "pt-BR",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <button
                onClick={fazerCheckin}
                disabled={fazendoCheckin}
                className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-green-600 text-white font-bold py-5 rounded-2xl text-lg transition-colors flex items-center justify-center gap-3"
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

        {/* Lista: quem chegou */}
        {chegaram.length > 0 && (
          <div className="mb-6">
            <p className="text-green-400 text-sm font-semibold mb-3">
              ✅ Já chegaram ({chegaram.length})
            </p>
            <div className="space-y-2">
              {chegaram.map((j) => (
                <div
                  key={j.id}
                  className="bg-green-900/40 border border-green-700/30 rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  {/* Posição */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      j.ordem_chegada === 1
                        ? "bg-yellow-500 text-yellow-950"
                        : j.ordem_chegada === 2
                          ? "bg-gray-400 text-gray-900"
                          : j.ordem_chegada === 3
                            ? "bg-orange-700 text-orange-100"
                            : "bg-green-800 text-green-400"
                    }`}
                  >
                    {j.ordem_chegada}º
                  </div>

                  {/* Nome */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">
                      {j.nome}
                    </p>
                    <p className="text-green-500 text-xs">
                      {j.posicao === "goleiro" ? "🧤 Goleiro" : "⚽ Linha"}
                      {j.checkin_em && (
                        <>
                          {" "}
                          ·{" "}
                          {new Date(j.checkin_em).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Admin pode cancelar */}
                  {isAdmin && (
                    <button
                      onClick={() => cancelarCheckin(j.user_id)}
                      className="text-red-500 text-xs hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-900/20 transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista: aguardando */}
        {aguardando.length > 0 && (
          <div>
            <p className="text-green-600 text-sm font-semibold mb-3">
              ⏳ Ainda não chegaram ({aguardando.length})
            </p>
            <div className="space-y-2">
              {aguardando.map((j) => (
                <div
                  key={j.id}
                  className={`bg-green-900/20 border border-green-900/40 rounded-xl px-4 py-3 flex items-center gap-3 ${isAdmin ? "" : "opacity-60"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-green-900 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-600 text-xs">—</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-green-400 text-sm truncate">{j.nome}</p>
                    <p className="text-green-600 text-xs">
                      {j.posicao === "goleiro" ? "🧤 Goleiro" : "⚽ Linha"}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => confirmarCheckinAdmin(j.user_id)}
                      className="text-green-500 text-xs hover:text-green-300 px-2 py-1 rounded-lg hover:bg-green-800/30 transition-colors whitespace-nowrap"
                    >
                      ✓ Chegou
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Aviso se não está na lista */}
        {!estouNaLista && (
          <div className="bg-yellow-900/20 border border-yellow-800/40 rounded-2xl p-5 text-center mt-4">
            <p className="text-yellow-400 text-sm">
              Você não está na lista desta partida.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}
