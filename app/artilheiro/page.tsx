"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ─── Helpers ───────────────────────────────────────────────────
function hojeEhDiaDoJogo(gameDate) {
  if (!gameDate) return false;
  const hoje = new Date();
  const jogo = new Date(gameDate);
  return (
    hoje.getFullYear() === jogo.getFullYear() &&
    hoje.getMonth() === jogo.getMonth() &&
    hoje.getDate() === jogo.getDate()
  );
}

function registroAberto(gameDate) {
  if (!hojeEhDiaDoJogo(gameDate)) return false;
  const agora = new Date();
  const limite = new Date();
  limite.setHours(13, 0, 0, 0);
  return agora < limite;
}

function tempoRestante(gameDate) {
  if (!hojeEhDiaDoJogo(gameDate)) return null;
  const agora = new Date();
  const limite = new Date();
  limite.setHours(13, 0, 0, 0);
  const diff = limite - agora;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h > 0 ? h + "h " : ""}${m}m ${s}s`;
}

// ─── Componente contador de gols ───────────────────────────────
function GolCounter({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-3">
      <button
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 text-white font-bold text-lg hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        −
      </button>
      <span className="text-2xl font-black text-white w-8 text-center tabular-nums">
        {value}
      </span>
      <button
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 font-bold text-lg hover:bg-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        +
      </button>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────
export default function Artilheiros() {
  const [game, setGame] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [participou, setParticipou] = useState(false);
  const [meusgols, setMeusGols] = useState(0);
  const [golsSalvos, setGolsSalvos] = useState(null); // null = ainda não registrou
  const [ranking, setRanking] = useState([]);
  const [rankingTemporada, setRankingTemporada] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [tempo, setTempo] = useState(null);
  const [aba, setAba] = useState("partida"); // partida | temporada
  const [editandoAdmin, setEditandoAdmin] = useState(null); // userId sendo editado pelo admin
  const [golsAdmin, setGolsAdmin] = useState(0);

  const init = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    setIsAdmin(userData?.role === "admin");

    // Jogo mais recente
    const { data: games } = await supabase
      .from("games")
      .select("*")
      .order("data_jogo", { ascending: false })
      .limit(1);
    const g = games?.[0];
    setGame(g);

    if (!g) {
      setLoading(false);
      return;
    }

    setAberto(registroAberto(g.data_jogo));

    // Verifica participação
    const { data: gp } = await supabase
      .from("game_players")
      .select("id")
      .eq("game_id", g.id)
      .eq("user_id", user.id)
      .eq("status", "confirmado")
      .single();
    setParticipou(!!gp);

    // Meus gols nessa partida
    const { data: meuReg } = await supabase
      .from("gols_partida")
      .select("gols")
      .eq("game_id", g.id)
      .eq("user_id", user.id)
      .single();
    if (meuReg) {
      setGolsSalvos(meuReg.gols);
      setMeusGols(meuReg.gols);
    }

    await fetchRankings(g.id);
    setLoading(false);
  }, []);

  async function fetchRankings(gameId) {
    // Ranking da partida
    const { data: partida } = await supabase
      .from("gols_partida")
      .select("gols, users(id, name, tipo)")
      .eq("game_id", gameId)
      .gt("gols", 0)
      .order("gols", { ascending: false });
    setRanking(partida || []);

    // Ranking temporada (soma de todos os jogos)
    const { data: temporada } = await supabase
      .from("gols_partida")
      .select("user_id, gols, users(id, name, tipo)")
      .gt("gols", 0);

    const acumulado = {};
    temporada?.forEach(({ user_id, gols, users }) => {
      if (!acumulado[user_id]) acumulado[user_id] = { user: users, total: 0 };
      acumulado[user_id].total += gols;
    });

    const sorted = Object.values(acumulado).sort((a, b) => b.total - a.total);
    setRankingTemporada(sorted);
  }

  async function salvarGols() {
    if (!game || !participou) return;
    setSalvando(true);

    await supabase.from("gols_partida").upsert(
      {
        game_id: game.id,
        user_id: userId,
        gols: meusgols,
      },
      { onConflict: "game_id,user_id" },
    );

    setGolsSalvos(meusgols);
    setSalvoOk(true);
    setTimeout(() => setSalvoOk(false), 2000);
    await fetchRankings(game.id);
    setSalvando(false);
  }

  async function salvarGolsAdmin(targetUserId) {
    await supabase.from("gols_partida").upsert(
      {
        game_id: game.id,
        user_id: targetUserId,
        gols: golsAdmin,
      },
      { onConflict: "game_id,user_id" },
    );
    setEditandoAdmin(null);
    await fetchRankings(game.id);
  }

  // Timer regressivo
  useEffect(() => {
    const interval = setInterval(() => {
      if (game) {
        setAberto(registroAberto(game.data_jogo));
        setTempo(tempoRestante(game.data_jogo));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [game]);

  useEffect(() => {
    init();
  }, [init]);

  const medalhas = ["🥇", "🥈", "🥉"];
  const listaAtual =
    aba === "partida"
      ? ranking
      : rankingTemporada.map((r) => ({ users: r.user, gols: r.total }));

  return (
    <div className="min-h-screen bg-[#0c0f0a] text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans:wght@400;500;600&display=swap');
        .font-black-han { font-family: 'Black Han Sans', sans-serif; }
        body { font-family: 'Noto Sans', sans-serif; }
        @keyframes slideIn { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
        .slide-in { animation: slideIn 0.3s ease forwards; }
        @keyframes ping-once { 0% { transform:scale(1); } 50% { transform:scale(1.15); } 100% { transform:scale(1); } }
        .ping-once { animation: ping-once 0.3s ease; }
        .ball-bg { background: radial-gradient(circle at 30% 30%, #1a2e0f, #0c0f0a); }
      `}</style>

      {/* Header */}
      <header className="ball-bg border-b border-white/5 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-black-han text-3xl text-white tracking-wide">
              ⚽ ARTILHEIROS
            </h1>
            <p className="text-zinc-500 text-xs">Futebol Lar Cristão</p>
          </div>
          {tempo && (
            <div className="text-right">
              <p className="text-xs text-zinc-500">Fecha em</p>
              <p className="text-emerald-400 font-mono font-bold text-sm">
                {tempo}
              </p>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="text-center py-20 text-zinc-600 animate-pulse">
            Carregando...
          </div>
        )}

        {!loading && !game && (
          <div className="text-center py-20 text-zinc-600">
            Nenhuma partida encontrada.
          </div>
        )}

        {!loading && game && (
          <>
            {/* Card de registro de gols */}
            {participou && (
              <div
                className={`rounded-3xl border p-6 space-y-4 ${
                  aberto
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-zinc-800 bg-zinc-900/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-semibold">Meus gols hoje</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {aberto
                        ? "Registre seus gols até as 13h"
                        : hojeEhDiaDoJogo(game.data_jogo)
                          ? "⛔ Registro encerrado (após 13h)"
                          : "Registro disponível apenas no dia da partida"}
                    </p>
                  </div>
                  {golsSalvos !== null && (
                    <div className="text-right">
                      <p className="text-zinc-500 text-xs">Salvo</p>
                      <p className="text-emerald-400 font-bold">
                        {golsSalvos} gol{golsSalvos !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <GolCounter
                    value={meusgols}
                    onChange={setMeusGols}
                    disabled={!aberto}
                  />
                  <button
                    onClick={salvarGols}
                    disabled={!aberto || salvando || meusgols === golsSalvos}
                    className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                      salvoOk
                        ? "bg-emerald-500 text-white"
                        : aberto && meusgols !== golsSalvos
                          ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    }`}
                  >
                    {salvoOk
                      ? "✅ Salvo!"
                      : salvando
                        ? "Salvando..."
                        : "Salvar"}
                  </button>
                </div>

                {aberto && meusgols !== golsSalvos && (
                  <p className="text-amber-500/70 text-xs">
                    ⚠️ Você tem alterações não salvas
                  </p>
                )}
              </div>
            )}

            {!participou && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-center text-zinc-500 text-sm">
                ⚽ Apenas jogadores confirmados na partida podem registrar gols.
              </div>
            )}

            {/* Abas: partida / temporada */}
            <div className="flex gap-2">
              {[
                { key: "partida", label: "🏟️ Partida atual" },
                { key: "temporada", label: "📅 Temporada" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setAba(tab.key)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    aba === tab.key
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Ranking */}
            <div className="space-y-2">
              {listaAtual.length === 0 && (
                <div className="text-center py-10 text-zinc-600 text-sm">
                  {aba === "partida"
                    ? "Nenhum gol registrado ainda nesta partida."
                    : "Nenhum gol registrado na temporada."}
                </div>
              )}

              {listaAtual.map((item, idx) => {
                const nome = item.users?.name || "Jogador";
                const gols = item.gols;
                const isEuMesmo = item.users?.id === userId;
                const maxGols = listaAtual[0]?.gols || 1;
                const pct = (gols / maxGols) * 100;

                return (
                  <div
                    key={item.users?.id || idx}
                    className={`relative rounded-2xl border overflow-hidden slide-in ${
                      idx === 0
                        ? "border-amber-500/40 bg-amber-500/5"
                        : isEuMesmo
                          ? "border-emerald-500/30 bg-emerald-500/5"
                          : "border-zinc-800 bg-zinc-900/30"
                    }`}
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    {/* Barra de fundo proporcional */}
                    <div
                      className={`absolute inset-y-0 left-0 opacity-10 transition-all duration-700 ${
                        idx === 0 ? "bg-amber-400" : "bg-emerald-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />

                    <div className="relative flex items-center gap-3 px-4 py-3.5">
                      {/* Medalha ou posição */}
                      <span className="text-lg w-7 text-center">
                        {idx < 3 ? (
                          medalhas[idx]
                        ) : (
                          <span className="text-zinc-600 text-sm">
                            {idx + 1}
                          </span>
                        )}
                      </span>

                      {/* Avatar */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          idx === 0
                            ? "bg-amber-500/20 border border-amber-500/50 text-amber-300"
                            : "bg-zinc-800 border border-zinc-700 text-zinc-400"
                        }`}
                      >
                        {nome[0].toUpperCase()}
                      </div>

                      {/* Nome */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-semibold truncate">
                            {nome}
                          </p>
                          {isEuMesmo && (
                            <span className="text-xs text-emerald-500">
                              você
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-600 text-xs">
                          {item.users?.tipo || "jogador"}
                        </p>
                      </div>

                      {/* Gols + edição admin */}
                      <div className="flex items-center gap-3">
                        {isAdmin &&
                        aba === "partida" &&
                        editandoAdmin === item.users?.id ? (
                          <div className="flex items-center gap-2">
                            <GolCounter
                              value={golsAdmin}
                              onChange={setGolsAdmin}
                              disabled={false}
                            />
                            <button
                              onClick={() => salvarGolsAdmin(item.users.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setEditandoAdmin(null)}
                              className="px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="text-right">
                              <p
                                className={`text-xl font-black ${idx === 0 ? "text-amber-400" : "text-white"}`}
                              >
                                {gols}
                              </p>
                              <p className="text-zinc-600 text-xs">
                                gol{gols !== 1 ? "s" : ""}
                              </p>
                            </div>
                            {isAdmin && aba === "partida" && (
                              <button
                                onClick={() => {
                                  setEditandoAdmin(item.users.id);
                                  setGolsAdmin(gols);
                                }}
                                className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors"
                                title="Corrigir gols (admin)"
                              >
                                ✏️
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Admin: adicionar gol para jogador não listado */}
            {isAdmin && aba === "partida" && (
              <AdminAdicionarGol
                game={game}
                jogadoresComGol={ranking.map((r) => r.users?.id)}
                onSalvo={() => fetchRankings(game.id)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── Admin: adicionar gols a jogador não listado ───────────────
function AdminAdicionarGol({ game, jogadoresComGol, onSalvo }) {
  const [aberto, setAberto] = useState(false);
  const [jogadores, setJogadores] = useState([]);
  const [selecionado, setSelecionado] = useState("");
  const [gols, setGols] = useState(0);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("game_players")
        .select("user_id, users(id, name)")
        .eq("game_id", game.id)
        .eq("status", "confirmado");
      const semGol = data?.filter((p) => !jogadoresComGol.includes(p.user_id));
      setJogadores(semGol || []);
    }
    if (aberto) fetch();
  }, [aberto, game.id, jogadoresComGol]);

  async function salvar() {
    if (!selecionado || gols <= 0) return;
    setSalvando(true);
    await supabase.from("gols_partida").upsert(
      {
        game_id: game.id,
        user_id: selecionado,
        gols,
      },
      { onConflict: "game_id,user_id" },
    );
    setSalvando(false);
    setAberto(false);
    setSelecionado("");
    setGols(0);
    onSalvo();
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="w-full py-3 rounded-2xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 text-sm transition-all"
      >
        + Registrar gols para outro jogador (admin)
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-700 bg-zinc-900 p-4 space-y-4">
      <p className="text-white font-semibold text-sm">Registrar gols (admin)</p>
      <select
        value={selecionado}
        onChange={(e) => setSelecionado(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
      >
        <option value="">Selecione o jogador...</option>
        {jogadores.map((j) => (
          <option key={j.user_id} value={j.user_id}>
            {j.users?.name}
          </option>
        ))}
      </select>
      <div className="flex items-center justify-between">
        <GolCounter value={gols} onChange={setGols} disabled={false} />
        <div className="flex gap-2">
          <button
            onClick={() => setAberto(false)}
            className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={!selecionado || gols <= 0 || salvando}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-sm disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
