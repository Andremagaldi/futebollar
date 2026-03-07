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
}
interface Artilheiro {
  nome: string;
  gols: number;
}

// ── Configs por time ───────────────────────────────
const TIME_CFG: Record<
  string,
  { bar: string; text: string; badge: string; num: string }
> = {
  "Time A": {
    bar: "bg-blue-600",
    text: "text-blue-400",
    badge: "bg-blue-600",
    num: "text-blue-950",
  },
  "Time B": {
    bar: "bg-red-600",
    text: "text-red-400",
    badge: "bg-red-600",
    num: "text-red-950",
  },
  "Time C": {
    bar: "bg-yellow-500",
    text: "text-yellow-400",
    badge: "bg-yellow-500",
    num: "text-yellow-950",
  },
  "Time D": {
    bar: "bg-purple-600",
    text: "text-purple-400",
    badge: "bg-purple-600",
    num: "text-purple-950",
  },
};
const CFG_DEFAULT = {
  bar: "bg-green-600",
  text: "text-green-400",
  badge: "bg-green-600",
  num: "text-green-950",
};

function formatTipo(tipo: string) {
  const map: Record<string, string> = {
    mensalista_membro: "Mensalista",
    mensalista_convidado: "Mensalista Convidado",
    avulso_membro: "Avulso",
    avulso_convidado: "Avulso Convidado",
  };
  return map[tipo] ?? tipo;
}

function EmptyState({ icon, msg }: { icon: string; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-gray-600">
      <span className="text-6xl mb-4">{icon}</span>
      <p className="text-lg text-gray-500">{msg}</p>
    </div>
  );
}

// ── Página principal ───────────────────────────────
export default function TelaoPage() {
  const [times, setTimes] = useState<Time[]>([]);
  const [confirmados, setConfirmados] = useState<Confirmado[]>([]);
  const [mvps, setMvps] = useState<MVP[]>([]);
  const [artilheiros, setArtilheiros] = useState<Artilheiro[]>([]);
  const [gameId, setGameId] = useState<string | null>(null);
  const [dataJogo, setDataJogo] = useState("");
  const [horaAtual, setHoraAtual] = useState("");
  const [aba, setAba] = useState<"times" | "lista" | "destaques">("times");

  // Relógio
  useEffect(() => {
    const tick = () =>
      setHoraAtual(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

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
    const mapa: Record<string, Jogador[]> = {};
    for (const row of data) {
      const nome = row.time_nome ?? "Time A";
      if (!mapa[nome]) mapa[nome] = [];
      mapa[nome].push({
        id: row.user_id,
        nome: (row.users as any)?.nome ?? "—",
        posicao: (row.users as any)?.posicao,
      });
    }
    setTimes(
      Object.entries(mapa).map(([nome, jogadores]) => ({ nome, jogadores })),
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
    // MVP — usa voted_for (nome real da coluna)
    const { data: votosData } = await supabase
      .from("mvp_votes")
      .select("voted_for, users!mvp_votes_voted_for_fkey(nome)")
      .eq("game_id", gid);

    if (votosData && votosData.length > 0) {
      const contagem: Record<string, { nome: string; votos: number }> = {};
      for (const v of votosData) {
        const id = v.voted_for;
        if (!contagem[id])
          contagem[id] = { nome: (v.users as any)?.nome ?? "—", votos: 0 };
        contagem[id].votos++;
      }
      setMvps(
        Object.values(contagem)
          .sort((a, b) => b.votos - a.votos)
          .slice(0, 3),
      );
    } else {
      setMvps([]);
    }

    // Artilheiros
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
      setArtilheiros(Object.values(contagem).sort((a, b) => b.gols - a.gols));
    } else {
      setArtilheiros([]);
    }
  }

  // ── RENDER ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none overflow-hidden">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-xl flex-shrink-0">
            ⚽
          </div>
          <div>
            <h1 className="font-display text-2xl tracking-widest text-white leading-none">
              FUTEBOL LAR CRISTÃO
            </h1>
            <p className="text-gray-500 text-xs capitalize mt-0.5">
              {dataJogo}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-4xl text-yellow-400 tabular-nums leading-none">
            {horaAtual}
          </p>
          <p className="text-gray-600 text-xs mt-1">
            {confirmados.length} confirmados · 🔴 ao vivo
          </p>
        </div>
      </header>

      {/* ── Abas ── */}
      <div className="flex border-b border-white/5 bg-gray-900/60">
        {(
          [
            { key: "times", label: "⚽ Times" },
            { key: "lista", label: "👥 Confirmados" },
            { key: "destaques", label: "🏆 Destaques" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAba(key)}
            className={`flex-1 py-3.5 text-sm font-semibold tracking-wide transition-all ${
              aba === key
                ? "text-white border-b-2 border-yellow-400"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Conteúdo ── */}
      <main className="flex-1 overflow-auto p-6">
        {/* ABA: TIMES */}
        {aba === "times" &&
          (times.length === 0 ? (
            <EmptyState icon="⚽" msg="Times ainda não foram sorteados" />
          ) : (
            <div
              className={`grid gap-4 ${times.length <= 2 ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}
            >
              {times.map((time) => {
                const cfg = TIME_CFG[time.nome] ?? CFG_DEFAULT;
                const goleiros = time.jogadores.filter(
                  (j) => j.posicao === "goleiro",
                );
                const linha = time.jogadores.filter(
                  (j) => j.posicao !== "goleiro",
                );
                return (
                  <div
                    key={time.nome}
                    className="rounded-2xl overflow-hidden bg-gray-900 border border-white/5"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                      <div
                        className={`w-3 h-8 rounded-full flex-shrink-0 ${cfg.bar}`}
                      />
                      <span
                        className={`font-display text-xl tracking-wider ${cfg.text}`}
                      >
                        {time.nome}
                      </span>
                      <span className="ml-auto text-xs text-gray-600">
                        {time.jogadores.length} jog.
                      </span>
                    </div>
                    {/* Goleiros */}
                    <ul className="px-3 pt-2 space-y-1">
                      {goleiros.map((j, i) => (
                        <li
                          key={j.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-yellow-900/20"
                        >
                          <span className="text-gray-600 text-xs w-4 text-right">
                            {i + 1}
                          </span>
                          <span className="text-white text-sm font-medium flex-1 truncate">
                            {j.nome}
                          </span>
                          <span className="text-yellow-400 text-xs">🧤</span>
                        </li>
                      ))}
                      {/* Linha */}
                      {linha.map((j, i) => (
                        <li
                          key={j.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${i % 2 === 0 ? "bg-white/[0.03]" : ""}`}
                        >
                          <span className="text-gray-700 text-xs w-4 text-right">
                            {goleiros.length + i + 1}
                          </span>
                          <span className="text-gray-200 text-sm font-medium flex-1 truncate">
                            {j.nome}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="h-3" />
                  </div>
                );
              })}
            </div>
          ))}

        {/* ABA: CONFIRMADOS */}
        {aba === "lista" &&
          (confirmados.length === 0 ? (
            <EmptyState icon="👥" msg="Nenhum jogador confirmado ainda" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {confirmados.map((j, i) => (
                <div
                  key={j.id}
                  className="bg-gray-900 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <span className="text-gray-700 text-sm font-mono w-6 flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {j.nome}
                    </p>
                    <p className="text-gray-600 text-xs">
                      {formatTipo(j.tipo)}
                    </p>
                  </div>
                  {j.posicao === "goleiro" && (
                    <span className="text-lg flex-shrink-0">🧤</span>
                  )}
                </div>
              ))}
            </div>
          ))}

        {/* ABA: DESTAQUES */}
        {aba === "destaques" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* MVP */}
            <div className="bg-gray-900 border border-yellow-800/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-2xl">🏅</span>
                <p className="font-display text-xl tracking-widest text-yellow-400">
                  MVP DA PARTIDA
                </p>
              </div>
              {mvps.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">
                  Votação em andamento...
                </p>
              ) : (
                <ul className="space-y-3">
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
                      <span className="text-yellow-400 font-bold text-sm tabular-nums flex-shrink-0">
                        {m.votos} {m.votos === 1 ? "voto" : "votos"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Artilheiros */}
            <div className="bg-gray-900 border border-orange-800/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-2xl">⚽</span>
                <p className="font-display text-xl tracking-widest text-orange-400">
                  ARTILHEIROS
                </p>
              </div>
              {artilheiros.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-6">
                  Nenhum gol registrado ainda
                </p>
              ) : (
                <ul className="space-y-3">
                  {artilheiros.map((a, i) => (
                    <li key={a.nome} className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          i === 0
                            ? "bg-yellow-500 text-yellow-950"
                            : i === 1
                              ? "bg-gray-400 text-gray-900"
                              : i === 2
                                ? "bg-orange-700 text-orange-100"
                                : "bg-gray-800 text-gray-400"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="flex-1 text-white font-medium truncate">
                        {a.nome}
                      </span>
                      <span className="text-orange-400 font-bold text-sm tabular-nums flex-shrink-0">
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

      {/* ── Footer ── */}
      <footer className="px-6 py-2.5 bg-gray-900/60 border-t border-white/5 flex items-center justify-between">
        <p className="text-gray-700 text-xs">
          🔴 Atualização automática em tempo real
        </p>
        <p className="text-gray-700 text-xs">
          Futebol Lar Cristão · Cristão · Organizado · Justo
        </p>
      </footer>
    </div>
  );
}
