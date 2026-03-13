"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";

// ─── Helpers ───────────────────────────────────────────────────
function hojeEhDiaDoJogo(gameDate: string | null): boolean {
  if (!gameDate) return false;
  const hoje = new Date();
  const jogo = new Date(gameDate);
  return (
    hoje.getFullYear() === jogo.getFullYear() &&
    hoje.getMonth() === jogo.getMonth() &&
    hoje.getDate() === jogo.getDate()
  );
}

function registroAberto(gameDate: string | null): boolean {
  if (!hojeEhDiaDoJogo(gameDate)) return false;
  const agora = new Date();
  const limite = new Date();
  limite.setHours(13, 0, 0, 0);
  return agora < limite;
}

function tempoRestante(gameDate: string | null): string | null {
  if (!hojeEhDiaDoJogo(gameDate)) return null;
  const agora = new Date();
  const limite = new Date();
  limite.setHours(13, 0, 0, 0);
  const diff = limite.getTime() - agora.getTime();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h > 0 ? h + "h " : ""}${m}m ${s}s`;
}

// ─── Types ─────────────────────────────────────────────────────
interface Game {
  id: string;
  data_jogo: string;
}
interface UserProfile {
  id: string;
  nome_completo: string;
  tipo: string;
}
interface RankingItem {
  gols: number;
  users: UserProfile | null;
}
interface RankingRow {
  gols: number;
  users: UserProfile | UserProfile[] | null;
}
interface TemporadaItem {
  user: UserProfile | null;
  total: number;
}

// ─── Sub: GolCounter ───────────────────────────────────────────
function GolCounter({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-white font-bold text-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        −
      </button>
      <span className="text-2xl font-black text-gray-900 dark:text-white w-8 text-center tabular-nums">
        {value}
      </span>
      <button
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-bold text-lg hover:bg-green-200 dark:hover:bg-green-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
      >
        +
      </button>
    </div>
  );
}

// ─── Sub: AdminAdicionarGol ────────────────────────────────────
function AdminAdicionarGol({
  game,
  jogadoresComGol,
  onSalvo,
}: {
  game: Game;
  jogadoresComGol: string[];
  onSalvo: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [jogadores, setJogadores] = useState<
    {
      user_id: string;
      users: Pick<UserProfile, "id" | "nome_completo"> | null;
    }[]
  >([]);
  const [selecionado, setSelecionado] = useState("");
  const [gols, setGols] = useState(0);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    async function fetchJogadores() {
      const { data } = await supabase
        .from("game_players")
        .select("user_id, users(id, nome_completo)")
        .eq("game_id", game.id)
        .eq("status", "confirmado");
      setJogadores(
        (data ?? [])
          .filter((p) => !jogadoresComGol.includes(p.user_id))
          .map((p) => ({
            user_id: p.user_id as string,
            users: Array.isArray(p.users) ? (p.users[0] ?? null) : p.users,
          })),
      );
    }
    if (aberto) fetchJogadores();
  }, [aberto, game.id, jogadoresComGol]);

  async function salvar() {
    if (!selecionado || gols <= 0) return;
    setSalvando(true);
    await supabase
      .from("gols_partida")
      .upsert(
        { game_id: game.id, user_id: selecionado, gols },
        { onConflict: "game_id,user_id" },
      );
    setSalvando(false);
    setAberto(false);
    setSelecionado("");
    setGols(0);
    onSalvo();
  }

  if (!aberto)
    return (
      <button
        onClick={() => setAberto(true)}
        className="w-full py-3.5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600 text-sm font-medium transition-all active:scale-[0.98]"
      >
        + Registrar gols para outro jogador (admin)
      </button>
    );

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 space-y-4">
      <p className="text-sm font-bold text-gray-900 dark:text-white">
        Registrar gols (admin)
      </p>
      <select
        value={selecionado}
        onChange={(e) => setSelecionado(e.target.value)}
        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Selecione o jogador...</option>
        {jogadores.map((j) => (
          <option key={j.user_id} value={j.user_id}>
            {j.users?.nome_completo}
          </option>
        ))}
      </select>
      <div className="flex items-center justify-between">
        <GolCounter value={gols} onChange={setGols} disabled={false} />
        <div className="flex gap-2">
          <button
            onClick={() => setAberto(false)}
            className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-medium active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={!selecionado || gols <= 0 || salvando}
            className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all"
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────
export default function ArtilheiroPage() {
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [participou, setParticipou] = useState(false);
  const [meusgols, setMeusGols] = useState(0);
  const [golsSalvos, setGolsSalvos] = useState<number | null>(null);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [rankingTemporada, setRankingTemporada] = useState<TemporadaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [tempo, setTempo] = useState<string | null>(null);
  const [aba, setAba] = useState("partida");
  const [editandoAdmin, setEditandoAdmin] = useState<string | null>(null);
  const [golsAdmin, setGolsAdmin] = useState(0);

  const fetchRankings = useCallback(async (gameId: string) => {
    const { data: partida } = await supabase
      .from("gols_partida")
      .select("gols, users(id, nome_completo, tipo)")
      .eq("game_id", gameId)
      .gt("gols", 0)
      .order("gols", { ascending: false });

    setRanking(
      (partida as RankingRow[] | null)?.map((row) => ({
        gols: row.gols,
        users: Array.isArray(row.users) ? (row.users[0] ?? null) : row.users,
      })) ?? [],
    );

    const { data: temporada } = await supabase
      .from("gols_partida")
      .select("user_id, gols, users(id, nome_completo, tipo)")
      .gt("gols", 0);

    const acumulado: Record<string, TemporadaItem> = {};
    temporada?.forEach(
      (row: {
        user_id: string;
        gols: number;
        users: UserProfile | UserProfile[] | null;
      }) => {
        const u = Array.isArray(row.users) ? (row.users[0] ?? null) : row.users;
        if (!acumulado[row.user_id])
          acumulado[row.user_id] = { user: u, total: 0 };
        acumulado[row.user_id].total += row.gols;
      },
    );
    setRankingTemporada(
      Object.values(acumulado).sort((a, b) => b.total - a.total),
    );
  }, []);

  const init = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const { data: ud } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    setIsAdmin(ud?.role === "admin");

    const { data: games } = await supabase
      .from("games")
      .select("*")
      .order("data_jogo", { ascending: false })
      .limit(1);
    const g = games?.[0] ?? null;
    setGame(g);
    if (!g) {
      setLoading(false);
      return;
    }

    setAberto(registroAberto(g.data_jogo));

    const { data: gp } = await supabase
      .from("game_players")
      .select("id")
      .eq("game_id", g.id)
      .eq("user_id", user.id)
      .eq("status", "confirmado")
      .single();
    setParticipou(!!gp);

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
  }, [fetchRankings, router]);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (game) {
        setAberto(registroAberto(game.data_jogo));
        setTempo(tempoRestante(game.data_jogo));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [game]);

  async function salvarGols() {
    if (!game || !participou) return;
    setSalvando(true);
    await supabase
      .from("gols_partida")
      .upsert(
        { game_id: game.id, user_id: userId, gols: meusgols },
        { onConflict: "game_id,user_id" },
      );
    setGolsSalvos(meusgols);
    setSalvoOk(true);
    setTimeout(() => setSalvoOk(false), 2000);
    await fetchRankings(game.id);
    setSalvando(false);
  }

  async function salvarGolsAdmin(targetUserId: string) {
    if (!game) return;
    await supabase
      .from("gols_partida")
      .upsert(
        { game_id: game.id, user_id: targetUserId, gols: golsAdmin },
        { onConflict: "game_id,user_id" },
      );
    setEditandoAdmin(null);
    await fetchRankings(game.id);
  }

  const medalhas = ["🥇", "🥈", "🥉"];
  const listaAtual: RankingItem[] =
    aba === "partida"
      ? ranking
      : rankingTemporada.map((r) => ({ users: r.user, gols: r.total }));

  return (
    <ProtectedRoute>
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
              <p className="text-xs text-gray-400 uppercase tracking-widest">
                Placar
              </p>
              <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
                ARTILHEIROS
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {tempo && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Fecha em</p>
                <p className="text-green-600 dark:text-green-400 font-mono font-bold text-sm">
                  {tempo}
                </p>
              </div>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : !game ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-5xl mb-4">⚽</p>
              <p className="font-display text-xl text-gray-900 dark:text-white">
                NENHUMA PARTIDA
              </p>
              <p className="text-sm text-gray-400 mt-2">
                Nenhuma partida encontrada.
              </p>
            </div>
          ) : (
            <>
              {/* ── Card meus gols ── */}
              {participou && (
                <div
                  className={`rounded-2xl p-5 border ${
                    aberto
                      ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40"
                      : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">
                        Meus gols hoje
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {aberto
                          ? "Registre seus gols até as 13h"
                          : hojeEhDiaDoJogo(game.data_jogo)
                            ? "⛔ Registro encerrado (após 13h)"
                            : "Disponível apenas no dia da partida"}
                      </p>
                    </div>
                    {golsSalvos !== null && (
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Salvo</p>
                        <p className="text-green-600 dark:text-green-400 font-bold text-sm">
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
                      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                        salvoOk
                          ? "bg-green-600 text-white"
                          : aberto && meusgols !== golsSalvos
                            ? "bg-green-600 text-white hover:bg-green-500"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
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
                    <p className="text-amber-500 text-xs mt-3">
                      ⚠️ Você tem alterações não salvas
                    </p>
                  )}
                </div>
              )}

              {!participou && (
                <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 text-center text-sm text-gray-400">
                  ⚽ Apenas jogadores confirmados na partida podem registrar
                  gols.
                </div>
              )}

              {/* ── Tabs ── */}
              <div className="flex gap-2">
                {[
                  { key: "partida", label: "🏟️ Partida" },
                  { key: "temporada", label: "📅 Temporada" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setAba(tab.key)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                      aba === tab.key
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                        : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Lista ranking ── */}
              <div className="space-y-2">
                {listaAtual.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    {aba === "partida"
                      ? "Nenhum gol registrado nesta partida."
                      : "Nenhum gol registrado na temporada."}
                  </div>
                )}

                {listaAtual.map((item, idx) => {
                  const nome = item.users?.nome_completo || "Jogador";
                  const gols = item.gols;
                  const isEu = item.users?.id === userId;
                  const maxGols = listaAtual[0]?.gols || 1;
                  const pct = (gols / maxGols) * 100;
                  const isFirst = idx === 0;

                  return (
                    <div
                      key={item.users?.id || idx}
                      className={`relative rounded-2xl border overflow-hidden ${
                        isFirst
                          ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40"
                          : isEu
                            ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30"
                            : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                      }`}
                    >
                      {/* barra progresso */}
                      <div
                        className={`absolute inset-y-0 left-0 opacity-10 transition-all duration-700 ${isFirst ? "bg-amber-400" : "bg-green-500"}`}
                        style={{ width: `${pct}%` }}
                      />

                      <div className="relative flex items-center gap-3 px-4 py-3.5">
                        <span className="text-lg w-7 text-center">
                          {idx < 3 ? (
                            medalhas[idx]
                          ) : (
                            <span className="text-gray-400 text-sm">
                              {idx + 1}
                            </span>
                          )}
                        </span>

                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                            isFirst
                              ? "bg-amber-100 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                              : "bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {nome[0].toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-gray-900 dark:text-white text-sm font-semibold truncate">
                              {nome}
                            </p>
                            {isEu && (
                              <span className="text-xs text-green-600 dark:text-green-500 font-medium">
                                você
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs">
                            {item.users?.tipo || "jogador"}
                          </p>
                        </div>

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
                                onClick={() =>
                                  item.users && salvarGolsAdmin(item.users.id)
                                }
                                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold active:scale-95"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditandoAdmin(null)}
                                className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 text-xs active:scale-95"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="text-right">
                                <p
                                  className={`text-xl font-black ${isFirst ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}
                                >
                                  {gols}
                                </p>
                                <p className="text-gray-400 text-xs">
                                  gol{gols !== 1 ? "s" : ""}
                                </p>
                              </div>
                              {isAdmin && aba === "partida" && (
                                <button
                                  onClick={() => {
                                    setEditandoAdmin(item.users?.id ?? null);
                                    setGolsAdmin(gols);
                                  }}
                                  className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 text-sm transition-colors"
                                  title="Corrigir (admin)"
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

              {isAdmin && aba === "partida" && (
                <AdminAdicionarGol
                  game={game}
                  jogadoresComGol={ranking.map((r) => r.users?.id ?? "")}
                  onSalvo={() => fetchRankings(game.id)}
                />
              )}
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
