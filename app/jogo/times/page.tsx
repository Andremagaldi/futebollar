"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useRouter } from "next/navigation";

type Player = {
  id: string;
  nome_completo: string;
  estrelas: number;
  posicao: string;
};
type Time = { nome: string; jogadores: Player[] };

const TIME_CONFIGS = [
  {
    border: "border-blue-200 dark:border-blue-800/50",
    header: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-600 dark:text-blue-400",
    avatar: "bg-gradient-to-br from-blue-500 to-blue-700",
    emoji: "🔵",
  },
  {
    border: "border-red-200 dark:border-red-800/50",
    header: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-600 dark:text-red-400",
    avatar: "bg-gradient-to-br from-red-500 to-red-700",
    emoji: "🔴",
  },
  {
    border: "border-green-200 dark:border-green-800/50",
    header: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-600 dark:text-green-400",
    avatar: "bg-gradient-to-br from-green-500 to-green-700",
    emoji: "🟢",
  },
  {
    border: "border-yellow-200 dark:border-yellow-700/50",
    header: "bg-yellow-50 dark:bg-yellow-900/20",
    text: "text-yellow-600 dark:text-yellow-400",
    avatar: "bg-gradient-to-br from-yellow-400 to-yellow-600",
    emoji: "🟡",
  },
];

export default function JogoTimesPage() {
  const router = useRouter();
  const [times, setTimes] = useState<Time[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmado, setConfirmado] = useState(false);
  const [dataJogo, setDataJogo] = useState("");

  useEffect(() => {
    fetchTimes();
  }, []);

  async function fetchTimes() {
    setLoading(true);
    const { data: games } = await supabase
      .from("games")
      .select("id, data_jogo, sorteio_confirmado")
      .order("data_jogo", { ascending: false })
      .limit(1);

    if (!games || games.length === 0) {
      setLoading(false);
      return;
    }
    const game = games[0];
    setConfirmado(game.sorteio_confirmado);
    setDataJogo(
      new Date(game.data_jogo + "T12:00:00").toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    );

    if (!game.sorteio_confirmado) {
      setLoading(false);
      return;
    }

    const { data: oficiais } = await supabase
      .from("times_sorteados")
      .select("user_id, nome_time, users(nome_completo, posicao, stars)")
      .eq("game_id", game.id);

    const agrupados: Record<string, Player[]> = {};
    oficiais?.forEach((item: any) => {
      if (!agrupados[item.nome_time]) agrupados[item.nome_time] = [];
      agrupados[item.nome_time].push({
        id: item.user_id,
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
    setLoading(false);
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen pb-28 bg-gray-50 dark:bg-gray-950">
        <header className="sticky top-0 z-40 px-4 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 active:scale-95 transition-all"
            >
              ←
            </button>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-widest capitalize">
                {dataJogo}
              </p>
              <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
                TIMES
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : !confirmado ? (
            <div className="flex flex-col items-center py-24 text-center">
              <p className="text-5xl mb-4">🔒</p>
              <p className="font-display text-2xl text-gray-900 dark:text-white mb-2">
                SORTEIO PENDENTE
              </p>
              <p className="text-sm text-gray-400">
                Os times serão exibidos após o admin confirmar o sorteio.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold text-sm text-green-700 dark:text-green-400">
                    Times oficiais confirmados!
                  </p>
                  <p className="text-xs text-green-500">
                    {times.length} times ·{" "}
                    {times.reduce((a, t) => a + t.jogadores.length, 0)}{" "}
                    jogadores
                  </p>
                </div>
              </div>

              <div
                className={`grid gap-3 ${times.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}
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
                      <div className="p-2 space-y-1">
                        {goleiros.map((j) => (
                          <div
                            key={j.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-yellow-50 dark:bg-yellow-900/10"
                          >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br from-yellow-400 to-yellow-600 flex-shrink-0">
                              {j.nome_completo.charAt(0)}
                            </div>
                            <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
                              {j.nome_completo.split(" ")[0]}
                            </span>
                            <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-semibold">
                              🧤
                            </span>
                          </div>
                        ))}
                        {linha.map((j, i) => (
                          <div
                            key={j.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-xl ${i % 2 === 0 ? "bg-gray-50 dark:bg-gray-800/50" : ""}`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 ${cfg.avatar}`}
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
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
