"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/layout/PageHeader";
import BottomNav from "@/components/layout/BottomNav";

const LIMITE_JOGADORES = 20;

type Game = {
  id: string;
  data_jogo: string;
  status_lista: string;
};

type Player = {
  id: string;
  status: "confirmado" | "espera";
  ordem_entrada: number;
  users: { nome_completo: string } | null;
};

type PlayerRow = Omit<Player, "users"> & {
  users: { nome_completo: string } | { nome_completo: string }[] | null;
};

type MyEntry = {
  id: string;
  status: "confirmado" | "espera";
};

export default function ListaPage() {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myEntry, setMyEntry] = useState<MyEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [aba, setAba] = useState<"confirmados" | "espera">("confirmados");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: gamesData } = await supabase
      .from("games")
      .select("*")
      .order("data_jogo", { ascending: false })
      .limit(1);

    if (!gamesData || gamesData.length === 0) {
      setGame(null);
      setPlayers([]);
      setMyEntry(null);
      setLoading(false);
      return;
    }

    const currentGame = gamesData[0];
    setGame(currentGame);

    const { data: playersData } = await supabase
      .from("game_players")
      .select(
        `id, status, ordem_entrada, user_id, users!game_players_user_id_fkey (nome_completo)`,
      )
      .eq("game_id", currentGame.id)
      .order("ordem_entrada", { ascending: true });

    const normalized =
      (playersData as PlayerRow[] | null)?.map((p) => ({
        ...p,
        users: Array.isArray(p.users) ? (p.users[0] ?? null) : p.users,
      })) ?? [];

    setPlayers(normalized);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: entry } = await supabase
        .from("game_players")
        .select("id, status")
        .eq("game_id", currentGame.id)
        .eq("user_id", user.id)
        .maybeSingle();
      setMyEntry(entry || null);
    }
    setLoading(false);
  }

  async function handleJoin() {
    if (!game) return;
    setActionLoading(true);
    const { error } = await supabase.rpc("entrar_na_lista", {
      p_game_id: game.id,
    });
    if (error) {
      alert(error.message);
    } else {
      await fetchData();
    }
    setActionLoading(false);
  }

  async function handleLeave() {
    if (!game) return;
    setActionLoading(true);
    const { error } = await supabase.rpc("sair_da_lista", {
      p_game_id: game.id,
    });
    if (error) {
      alert(error.message);
    } else {
      await fetchData();
    }
    setActionLoading(false);
  }

  const confirmadosList = players.filter((p) => p.status === "confirmado");
  const esperaList = players.filter((p) => p.status === "espera");
  const vagasRestantes = LIMITE_JOGADORES - confirmadosList.length;
  const lista = aba === "confirmados" ? confirmadosList : esperaList;

  return (
    <ProtectedRoute>
      <div className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-950">
        <PageHeader
          title="LISTA DO JOGO"
          subtitle={
            game
              ? `${game.data_jogo.split("-").reverse().join("/")} · ${game.status_lista}`
              : ""
          }
        />

        {/* ── Loading ── */}
        {loading && (
          <div className="px-4 pt-6 space-y-3">
            <div className="h-32 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
              />
            ))}
          </div>
        )}

        {/* ── Sem jogo ── */}
        {!loading && !game && (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <p className="text-5xl mb-4">📅</p>
            <p className="font-display text-2xl text-gray-900 dark:text-white mb-2">
              SEM JOGO CADASTRADO
            </p>
            <p className="text-sm text-gray-400">
              Aguarde o administrador criar a próxima partida.
            </p>
          </div>
        )}

        {!loading && game && (
          <>
            {/* ── Banner vagas ── */}
            <div className="px-4 py-4">
              <div className="rounded-2xl p-4 relative overflow-hidden bg-gradient-to-br from-blue-700 to-blue-900 shadow-lg">
                <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-white opacity-10" />
                <div className="absolute right-10 -bottom-8 w-24 h-24 rounded-full bg-white opacity-10" />

                <div className="relative z-10 flex items-end justify-between">
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-widest mb-1">
                      Vagas preenchidas
                    </p>
                    <div className="flex items-end gap-2">
                      <span className="font-display text-5xl text-white leading-none">
                        {confirmadosList.length}
                      </span>
                      <span className="text-white/40 text-xl mb-1">
                        / {LIMITE_JOGADORES}
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full overflow-hidden bg-white/15 w-44">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 transition-all duration-700"
                        style={{
                          width: `${(confirmadosList.length / LIMITE_JOGADORES) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-right relative z-10">
                    <p className="text-white/60 text-xs mb-1">Na espera</p>
                    <span className="font-display text-3xl text-white">
                      {esperaList.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Status do jogador + ação ── */}
            <div className="px-4 mb-4">
              {myEntry ? (
                <div
                  className={`flex items-center justify-between p-4 rounded-2xl border ${
                    myEntry.status === "confirmado"
                      ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40"
                      : "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {myEntry.status === "confirmado" ? "✅" : "⏳"}
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">
                        {myEntry.status === "confirmado"
                          ? "Você está confirmado!"
                          : "Você está na espera"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {myEntry.status === "confirmado"
                          ? "Toque para sair da lista"
                          : "Você será promovido se houver desistência"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleLeave}
                    disabled={actionLoading}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "..." : "Sair"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={actionLoading}
                  className="w-full py-4 rounded-2xl font-bold text-base text-white bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {actionLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Entrando...
                    </span>
                  ) : vagasRestantes > 0 ? (
                    `⚽ Entrar na lista · ${vagasRestantes} vaga${vagasRestantes !== 1 ? "s" : ""}`
                  ) : (
                    "⏳ Entrar na lista de espera"
                  )}
                </button>
              )}
            </div>

            {/* ── Abas ── */}
            <div className="px-4 mb-4">
              <div className="flex rounded-xl p-1 gap-1 bg-gray-200 dark:bg-gray-800">
                {(
                  [
                    {
                      key: "confirmados",
                      label: `✅ Confirmados (${confirmadosList.length})`,
                    },
                    {
                      key: "espera",
                      label: `⏳ Espera (${esperaList.length})`,
                    },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setAba(key)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      aba === key
                        ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-400 dark:text-gray-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Lista de jogadores ── */}
            <div className="px-4 space-y-2">
              {lista.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">⚽</p>
                  <p className="font-semibold text-gray-500 dark:text-gray-600">
                    {aba === "confirmados"
                      ? "Nenhum jogador confirmado ainda"
                      : "Lista de espera vazia"}
                  </p>
                </div>
              ) : (
                lista.map((player, index) => {
                  const isMe = myEntry?.id === player.id;
                  const numero =
                    aba === "espera"
                      ? confirmadosList.length + index + 1
                      : index + 1;
                  return (
                    <div
                      key={player.id}
                      className={`flex items-center gap-3 p-3 rounded-2xl border shadow-sm transition-all ${
                        isMe
                          ? "bg-blue-50 dark:bg-blue-900/10 border-blue-300 dark:border-blue-700"
                          : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                      }`}
                    >
                      {/* Número */}
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          aba === "confirmados" && index === 0
                            ? "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {aba === "confirmados" && index === 0
                          ? "👑"
                          : `#${numero}`}
                      </div>

                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase text-white flex-shrink-0 ${
                          isMe
                            ? "bg-gradient-to-br from-blue-500 to-blue-700"
                            : "bg-gradient-to-br from-gray-400 to-gray-600"
                        }`}
                      >
                        {player.users?.nome_completo?.charAt(0) ?? "?"}
                      </div>

                      {/* Nome */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-semibold text-sm truncate ${
                            isMe
                              ? "text-blue-700 dark:text-blue-400"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {player.users?.nome_completo ?? "—"}
                          {isMe && (
                            <span className="ml-2 text-xs font-normal text-blue-400">
                              ← você
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Badge status */}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          player.status === "confirmado"
                            ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                            : "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                        }`}
                      >
                        {player.status === "confirmado" ? "✅" : "⏳"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
