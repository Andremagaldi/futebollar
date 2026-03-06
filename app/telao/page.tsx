"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

// ── Tipos ──────────────────────────────────────────
interface Jogador {
  id: string;
  nome: string;
  posicao?: string;
}

interface Time {
  nome: string;
  cor: string;
  jogadores: Jogador[];
}

interface Confirmado {
  id: string;
  nome: string;
  tipo: string;
  posicao: string;
}

interface MVP {
  nome: string;
  votos: number;
  foto_url?: string;
}

interface Artilheiro {
  nome: string;
  gols: number;
  foto_url?: string;
}

// ── Cores dos times ────────────────────────────────
const CORES_TIMES: Record<
  string,
  { bg: string; border: string; text: string; badge: string }
> = {
  "Time A": {
    bg: "from-blue-900/60 to-blue-950/80",
    border: "border-blue-500/40",
    text: "text-blue-300",
    badge: "bg-blue-600",
  },
  "Time B": {
    bg: "from-red-900/60 to-red-950/80",
    border: "border-red-500/40",
    text: "text-red-300",
    badge: "bg-red-600",
  },
  "Time C": {
    bg: "from-yellow-900/60 to-yellow-950/80",
    border: "border-yellow-500/40",
    text: "text-yellow-300",
    badge: "bg-yellow-600",
  },
  "Time D": {
    bg: "from-purple-900/60 to-purple-950/80",
    border: "border-purple-500/40",
    text: "text-purple-300",
    badge: "bg-purple-600",
  },
};

const COR_DEFAULT = {
  bg: "from-green-900/60 to-green-950/80",
  border: "border-green-500/40",
  text: "text-green-300",
  badge: "bg-green-600",
};

export default function TelaoPage() {
  const [times, setTimes] = useState<Time[]>([]);
  const [confirmados, setConfirmados] = useState<Confirmado[]>([]);
  const [mvps, setMvps] = useState<MVP[]>([]);
  const [artilheiros, setArtilheiros] = useState<Artilheiro[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [dataJogo, setDataJogo] = useState<string>("");
  const [horaAtual, setHoraAtual] = useState("");
  const [aba, setAba] = useState<"times" | "lista" | "destaques">("times");

  // Relógio
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setHoraAtual(
        now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      );
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Carrega jogo mais recente e dados
  useEffect(() => {
    loadGame();
  }, []);

  // Realtime
  useEffect(() => {
    if (!gameId) return;

    const channel = supabase
      .channel("telao-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "times_sorteados" },
        () => loadTimes(gameId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players" },
        () => loadConfirmados(gameId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mvp_votes" },
        () => loadDestaques(gameId),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gols_partida" },
        () => loadDestaques(gameId),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  async function loadGame() {
    const { data } = await supabase
      .from("games")
      .select("id, data_jogo")
      .order("data_jogo", { ascending: false })
      .limit(1)
      .single();

    if (!data) return;

    setGameId(data.id);
    setDataJogo(
      new Date(data.data_jogo).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }),
    );

    await Promise.all([
      loadTimes(data.id),
      loadConfirmados(data.id),
      loadDestaques(data.id),
    ]);
  }

  async function loadTimes(gid: string) {
    const { data } = await supabase
      .from("times_sorteados")
      .select("*, users(nome, posicao)")
      .eq("game_id", gid)
      .order("time_nome");

    if (!data) return;

    // Agrupa por time
    const mapa: Record<string, Jogador[]> = {};
    for (const row of data) {
      const nome = row.time_nome ?? "Time A";
      if (!mapa[nome]) mapa[nome] = [];
      mapa[nome].push({
        id: row.user_id,
        nome: row.users?.nome ?? "—",
        posicao: row.users?.posicao,
      });
    }

    setTimes(
      Object.entries(mapa).map(([nome, jogadores]) => ({
        nome,
        cor: nome,
        jogadores,
      })),
    );
  }

  async function loadConfirmados(gid: string) {
    const { data } = await supabase
      .from("game_players")
      .select("id, tipo, posicao, users(id, nome)")
      .eq("game_id", gid)
      .eq("status", "confirmado")
      .order("ordem_entrada");

    if (!data) return;

    setConfirmados(
      data.map((d) => ({
        id: d.id,
        nome: (d.users as any)?.nome ?? "—",
        tipo: d.tipo,
        posicao: d.posicao,
      })),
    );
  }

  async function loadDestaques(gid: string) {
    // MVP — mais votado
    const { data: votosData } = await supabase
      .from("mvp_votes")
      .select("votado_id, users!mvp_votes_votado_id_fkey(nome)")
      .eq("game_id", gid);

    if (votosData && votosData.length > 0) {
      const contagem: Record<string, { nome: string; votos: number }> = {};
      for (const v of votosData) {
        const id = v.votado_id;
        if (!contagem[id])
          contagem[id] = { nome: (v.users as any)?.nome ?? "—", votos: 0 };
        contagem[id].votos++;
      }
      const top3 = Object.values(contagem)
        .sort((a, b) => b.votos - a.votos)
        .slice(0, 3);
      setMvps(top3);
    } else {
      setMvps([]);
    }

    // Artilheiro — mais gols
    const { data: golsData } = await supabase
      .from("gols_partida")
      .select("user_id, gols, users(nome)")
      .eq("game_id", gid);

    if (golsData && golsData.length > 0) {
      const contagem: Record<string, { nome: string; gols: number }> = {};
      for (const g of golsData) {
        const id = g.user_id;
        if (!contagem[id])
          contagem[id] = { nome: (g.users as any)?.nome ?? "—", gols: 0 };
        contagem[id].gols += g.gols ?? 1;
      }
      const ranking = Object.values(contagem).sort((a, b) => b.gols - a.gols);
      setArtilheiros(ranking);
    } else {
      setArtilheiros([]);
    }
  }

  // ── RENDER ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-green-950 text-white flex flex-col select-none overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-green-900/50 border-b border-green-800/50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center text-xl">
            ⚽
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wide">
              Futebol Lar Cristão
            </h1>
            <p className="text-green-400 text-sm capitalize">{dataJogo}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-mono font-bold text-green-300">
            {horaAtual}
          </p>
          <p className="text-green-500 text-xs">
            {confirmados.length} jogadores confirmados
          </p>
        </div>
      </header>

      {/* Abas */}
      <div className="flex border-b border-green-800/50 bg-green-900/30">
        {[
          { key: "times", label: "⚽ Times" },
          { key: "lista", label: "👥 Confirmados" },
          { key: "destaques", label: "🏆 Destaques" },
        ].map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key as typeof aba)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              aba === a.key
                ? "text-white border-b-2 border-green-400"
                : "text-green-500 hover:text-green-300"
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto p-6">
        {/* ABA: TIMES */}
        {aba === "times" && (
          <div>
            {times.length === 0 ? (
              <EmptyState icon="⚽" msg="Times ainda não foram sorteados" />
            ) : (
              <div
                className={`grid gap-4 ${times.length <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}
              >
                {times.map((time) => {
                  const cor = CORES_TIMES[time.nome] ?? COR_DEFAULT;
                  return (
                    <div
                      key={time.nome}
                      className={`bg-gradient-to-b ${cor.bg} border ${cor.border} rounded-2xl overflow-hidden`}
                    >
                      {/* Header do time */}
                      <div
                        className={`px-4 py-3 flex items-center gap-2 border-b ${cor.border}`}
                      >
                        <span
                          className={`${cor.badge} text-white text-xs font-bold px-2 py-0.5 rounded-full`}
                        >
                          {time.nome}
                        </span>
                        <span className={`ml-auto text-xs ${cor.text}`}>
                          {time.jogadores.length} jogadores
                        </span>
                      </div>
                      {/* Jogadores */}
                      <ul className="p-3 space-y-1.5">
                        {time.jogadores.map((j, i) => (
                          <li key={j.id} className="flex items-center gap-2">
                            <span className="text-green-600 text-xs w-4 text-right">
                              {i + 1}
                            </span>
                            <span className="text-white text-sm font-medium flex-1 truncate">
                              {j.nome}
                            </span>
                            {j.posicao === "goleiro" && (
                              <span className="text-yellow-400 text-xs">
                                🧤
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA: CONFIRMADOS */}
        {aba === "lista" && (
          <div>
            {confirmados.length === 0 ? (
              <EmptyState icon="👥" msg="Nenhum jogador confirmado ainda" />
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {confirmados.map((j, i) => (
                  <div
                    key={j.id}
                    className="bg-green-900/40 border border-green-800/40 rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-green-600 text-sm font-mono w-6">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {j.nome}
                      </p>
                      <p className="text-green-500 text-xs">
                        {formatTipo(j.tipo)}
                      </p>
                    </div>
                    {j.posicao === "goleiro" && (
                      <span className="text-lg">🧤</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: DESTAQUES */}
        {aba === "destaques" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* MVP */}
            <div className="bg-gradient-to-b from-yellow-900/50 to-yellow-950/80 border border-yellow-600/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏅</span>
                <p className="text-yellow-400 text-sm font-semibold uppercase tracking-widest">
                  MVP da Partida
                </p>
              </div>
              {mvps.length === 0 ? (
                <p className="text-yellow-600 text-sm text-center py-4">
                  Votação em andamento...
                </p>
              ) : (
                <ul className="space-y-2">
                  {mvps.map((m, i) => (
                    <li key={m.nome} className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i === 0
                            ? "bg-yellow-500 text-yellow-950"
                            : i === 1
                              ? "bg-gray-400 text-gray-900"
                              : "bg-orange-700 text-orange-100"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 text-white font-medium truncate">
                        {m.nome}
                      </span>
                      <span className="text-yellow-400 font-bold text-sm tabular-nums">
                        {m.votos} {m.votos === 1 ? "voto" : "votos"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Artilheiros */}
            <div className="bg-gradient-to-b from-orange-900/50 to-orange-950/80 border border-orange-600/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">⚽</span>
                <p className="text-orange-400 text-sm font-semibold uppercase tracking-widest">
                  Artilheiros
                </p>
              </div>
              {artilheiros.length === 0 ? (
                <p className="text-orange-600 text-sm text-center py-4">
                  Nenhum gol registrado ainda
                </p>
              ) : (
                <ul className="space-y-2">
                  {artilheiros.map((a, i) => (
                    <li key={a.nome} className="flex items-center gap-3">
                      {/* Posição */}
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i === 0
                            ? "bg-yellow-500 text-yellow-950"
                            : i === 1
                              ? "bg-gray-400 text-gray-900"
                              : i === 2
                                ? "bg-orange-700 text-orange-100"
                                : "bg-green-900 text-green-400"
                        }`}
                      >
                        {i + 1}
                      </span>
                      {/* Nome */}
                      <span className="flex-1 text-white font-medium truncate">
                        {a.nome}
                      </span>
                      {/* Gols */}
                      <span className="text-orange-400 font-bold text-sm tabular-nums">
                        {a.gols} {a.gols === 1 ? "gol" : "gols"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-6 py-2 bg-green-900/30 border-t border-green-800/50 flex items-center justify-between">
        <p className="text-green-600 text-xs">
          🔴 Ao vivo — atualização automática
        </p>
        <p className="text-green-700 text-xs">Futebol Lar Cristão</p>
      </footer>
    </div>
  );
}

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-green-600">
      <span className="text-5xl mb-4">{icon}</span>
      <p className="text-lg">{msg}</p>
    </div>
  );
}

function formatTipo(tipo: string) {
  const map: Record<string, string> = {
    mensalista_membro: "Mensalista",
    mensalista_convidado: "Mensalista Convidado",
    avulso_membro: "Avulso",
    avulso_convidado: "Avulso Convidado",
  };
  return map[tipo] ?? tipo;
}
