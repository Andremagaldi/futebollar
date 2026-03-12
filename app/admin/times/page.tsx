"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRole } from "@/hooks/useRole";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { sortearTimes } from "@/lib/sortearTimes";
import { useRouter } from "next/navigation";

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

function formatarParaWhatsApp(times: Time[], dataJogo: string) {
  const data = new Date(dataJogo + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  let txt = `⚽ *FUTEBOL LAR CRISTÃO*\n📅 ${cap(data)}\n${"─".repeat(28)}\n\n`;
  times.forEach((time, idx) => {
    const emoji = ["🔵", "🔴", "🟢", "🟡"][idx] || "⚪";
    txt += `${emoji} *${time.nome.toUpperCase()}*\n`;
    time.jogadores.forEach((j, i) => {
      const pos = j.posicao === "goleiro" ? "🧤" : `${i}.`;
      txt += `  ${pos} ${j.nome_completo.split(" ")[0]}\n`;
    });
    txt += "\n";
  });
  txt += `${"─".repeat(28)}\n✨ Bom jogo a todos! 🙏`;
  return txt;
}

export default function AdminTimesPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useRole();

  const [gameId, setGameId] = useState<string | null>(null);
  const [dataJogo, setDataJogo] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [sorteioConfirmado, setSorteioConfirmado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [aba, setAba] = useState<"times" | "whatsapp">("times");

  useEffect(() => {
    if (!roleLoading) fetchData();
  }, [roleLoading]);

  async function fetchData() {
    setLoading(true);
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
    setDataJogo(game.data_jogo);
    setSorteioConfirmado(game.sorteio_confirmado);

    if (game.sorteio_confirmado) {
      const { data: oficiais } = await supabase
        .from("times_sorteados")
        .select("user_id, nome_time, users(nome_completo, posicao, stars)")
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
      const { data: jogadores } = await supabase
        .from("game_players")
        .select("user_id, users(nome_completo, posicao, stars)")
        .eq("game_id", game.id)
        .eq("status", "confirmado");

      const norm =
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
      setPlayers(norm);
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

  async function handleDesconfirmar() {
    if (!gameId) return;
    await supabase
      .from("games")
      .update({ sorteio_confirmado: false })
      .eq("id", gameId);
    setSorteioConfirmado(false);
    setTimes([]);
    await fetchData();
  }

  async function copiarWhatsApp() {
    const txt = formatarParaWhatsApp(times, dataJogo);
    try {
      await navigator.clipboard.writeText(txt);
    } catch {
      const el = document.createElement("textarea");
      el.value = txt;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  function abrirWhatsApp() {
    const txt = formatarParaWhatsApp(times, dataJogo);
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  }

  const whatsappPreview =
    times.length > 0 ? formatarParaWhatsApp(times, dataJogo) : "";

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
                Admin · Times
              </p>
              <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
                {sorteioConfirmado ? "TIMES OFICIAIS" : "SORTEIO"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 active:scale-95 transition-all"
            >
              🔄
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
          {loading || roleLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : (
            <>
              {/* ── Status banner ── */}
              <div
                className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${
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
                      ? "Compartilhe os times pelo WhatsApp"
                      : times.length > 0
                        ? "Revise e confirme para oficializar"
                        : "Toque em Gerar Sorteio para sortear"}
                  </p>
                </div>
              </div>

              {/* ── Botões de ação ── */}
              {!sorteioConfirmado && (
                <div className="flex gap-3">
                  <button
                    onClick={handleSortear}
                    disabled={players.length === 0}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 to-blue-800 shadow-lg active:scale-[0.98] transition-all disabled:opacity-40"
                  >
                    {times.length > 0 ? "🔀 Regerar" : "🎲 Gerar Sorteio"}
                  </button>
                  {times.length > 0 && (
                    <button
                      onClick={handleConfirmar}
                      disabled={confirmando}
                      className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-green-600 to-green-800 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {confirmando ? (
                        <>
                          <Spinner /> Confirmando...
                        </>
                      ) : (
                        "✅ Confirmar Oficial"
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* ── Botões pós-confirmação ── */}
              {sorteioConfirmado && (
                <div className="flex gap-3">
                  <button
                    onClick={copiarWhatsApp}
                    className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] border ${
                      copiado
                        ? "bg-green-50 dark:bg-green-900/10 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400"
                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {copiado ? "✅ Copiado!" : "📋 Copiar texto"}
                  </button>
                  <button
                    onClick={abrirWhatsApp}
                    className="flex-1 py-3.5 rounded-2xl font-bold text-sm text-white bg-[#25d366] hover:bg-[#20ba58] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    WhatsApp
                  </button>
                </div>
              )}

              {/* ── Abas (times / whatsapp preview) ── */}
              {times.length > 0 && sorteioConfirmado && (
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-2xl p-1">
                  {(["times", "whatsapp"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setAba(a)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        aba === a
                          ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-400"
                      }`}
                    >
                      {a === "times" ? "⚽ Times" : "💬 Preview WhatsApp"}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Grid de times ── */}
              {times.length > 0 && (aba === "times" || !sorteioConfirmado) && (
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
              )}

              {/* ── Preview WhatsApp ── */}
              {aba === "whatsapp" && sorteioConfirmado && (
                <div className="rounded-2xl bg-[#1f2c33] p-4 overflow-x-auto">
                  <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                    {whatsappPreview}
                  </pre>
                </div>
              )}

              {/* ── Desconfirmar (admin pode resetar) ── */}
              {sorteioConfirmado && (
                <button
                  onClick={handleDesconfirmar}
                  className="w-full py-3 rounded-2xl text-xs font-semibold text-red-400 border border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/10 active:scale-[0.98] transition-all"
                >
                  ⚠️ Desfazer confirmação e reSortear
                </button>
              )}

              {/* ── Lista vazia ── */}
              {times.length === 0 && players.length === 0 && (
                <div className="flex flex-col items-center py-20 text-center">
                  <p className="text-5xl mb-3">📋</p>
                  <p className="font-display text-xl text-gray-900 dark:text-white">
                    LISTA VAZIA
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Nenhum jogador confirmado ainda.
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
    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
  );
}
