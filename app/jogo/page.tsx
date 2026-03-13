"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRole } from "@/hooks/useRole";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";
import ProtectedRoute from "@/components/ProtectedRoute";

interface Game {
  id: string;
  data_jogo: string;
  status_lista: string;
  sorteio_confirmado: boolean;
  votacao_encerrada: boolean;
}

interface MyStatus {
  status: "confirmado" | "espera" | null;
  pagamento_status: string | null;
  multa_aplicada: boolean;
}

interface Stats {
  confirmados: number;
  espera: number;
  totalVotos: number;
  meuVoto: boolean;
  topArtilheiro: string | null;
  gols: number;
}

export default function JogoPage() {
  const router = useRouter();
  const { isAdmin, isGerente, role, userId, loading: roleLoading } = useRole();
  const [game, setGame] = useState<Game | null>(null);
  const [myStatus, setMyStatus] = useState<MyStatus>({
    status: null,
    pagamento_status: null,
    multa_aplicada: false,
  });
  const [stats, setStats] = useState<Stats>({
    confirmados: 0,
    espera: 0,
    totalVotos: 0,
    meuVoto: false,
    topArtilheiro: null,
    gols: 0,
  });
  const [nomeUsuario, setNomeUsuario] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading) fetchData();
  }, [roleLoading, userId]);

  async function fetchData() {
    if (!userId) return;
    setLoading(true);

    // Usuário
    const { data: userData } = await supabase
      .from("users")
      .select("nome_completo")
      .eq("id", userId)
      .single();
    setNomeUsuario(userData?.nome_completo?.split(" ")[0] ?? "");

    // Último jogo
    const { data: games } = await supabase
      .from("games")
      .select("*")
      .order("data_jogo", { ascending: false })
      .limit(1);
    if (!games || games.length === 0) {
      setLoading(false);
      return;
    }
    const g = games[0];
    setGame(g);

    // Meu status na lista
    const { data: entry } = await supabase
      .from("game_players")
      .select("status, pagamento_status, multa_aplicada")
      .eq("game_id", g.id)
      .eq("user_id", userId)
      .maybeSingle();
    setMyStatus({
      status: entry?.status ?? null,
      pagamento_status: entry?.pagamento_status ?? null,
      multa_aplicada: entry?.multa_aplicada ?? false,
    });

    // Confirmados e espera
    const { data: players } = await supabase
      .from("game_players")
      .select("status")
      .eq("game_id", g.id);
    const confirmados =
      players?.filter((p) => p.status === "confirmado").length ?? 0;
    const espera = players?.filter((p) => p.status === "espera").length ?? 0;

    // Votos MVP
    const { data: votos } = await supabase
      .from("mvp_votes")
      .select("voter_id")
      .eq("game_id", g.id);
    const totalVotos = votos?.length ?? 0;
    const meuVoto = votos?.some((v) => v.voter_id === userId) ?? false;

    // Top artilheiro
    const { data: gols } = await supabase
      .from("gols_partida")
      .select("user_id, gols, users(nome_completo)")
      .eq("game_id", g.id);
    let topArtilheiro = null;
    let topGols = 0;
    if (gols && gols.length > 0) {
      const sorted = [...gols].sort((a, b) => (b.gols ?? 1) - (a.gols ?? 1));
      topArtilheiro =
        (sorted[0].users as any)?.nome_completo?.split(" ")[0] ?? null;
      topGols = sorted[0].gols ?? 1;
    }

    setStats({
      confirmados,
      espera,
      totalVotos,
      meuVoto,
      topArtilheiro,
      gols: topGols,
    });
    setLoading(false);
  }

  const hoje = new Date().toISOString().split("T")[0];
  const isDiaJogo = game?.data_jogo === hoje;

  function formatData(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }

  function statusListaLabel() {
    if (!game) return "";
    const map: Record<string, string> = {
      aberta: "Lista aberta",
      fechada: "Lista fechada",
      encerrada: "Encerrada",
    };
    return map[game.status_lista] ?? game.status_lista;
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen pb-28 bg-gray-50 dark:bg-gray-950">
        {/* ── Header ── */}
        <header className="sticky top-0 z-40 px-4 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest">
              {roleLoading
                ? ""
                : isAdmin
                  ? "⚙️ Admin"
                  : isGerente
                    ? "💼 Gerente"
                    : "👋 Olá,"}
            </p>
            <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
              {loading ? "..." : nomeUsuario.toUpperCase() || "FUTEBOLLAR"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/telao"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-lg active:scale-95 transition-all"
              title="Telão"
            >
              📺
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
          {/* ── Loading ── */}
          {(loading || roleLoading) && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          )}

          {!loading && !roleLoading && (
            <>
              {/* ── Sem jogo ── */}
              {!game && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-5xl mb-4">📅</p>
                  <p className="font-display text-xl text-gray-900 dark:text-white">
                    SEM PARTIDA ATIVA
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Aguarde o admin criar o próximo jogo.
                  </p>
                </div>
              )}

              {game && (
                <>
                  {/* ── Card da partida ── */}
                  <div className="rounded-3xl p-5 relative overflow-hidden bg-gradient-to-br from-blue-700 to-blue-900 shadow-xl">
                    <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white opacity-10" />
                    <div className="absolute right-12 -bottom-10 w-28 h-28 rounded-full bg-white opacity-10" />
                    <div className="relative z-10">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white/60 text-xs uppercase tracking-widest mb-1">
                            Próxima partida
                          </p>
                          <p className="font-display text-2xl text-white leading-tight capitalize">
                            {formatData(game.data_jogo)}
                          </p>
                        </div>
                        <span
                          className={`text-xs px-3 py-1.5 rounded-full font-semibold flex-shrink-0 ${
                            game.status_lista === "aberta"
                              ? "bg-green-400/20 text-green-300"
                              : "bg-white/15 text-white/60"
                          }`}
                        >
                          {statusListaLabel()}
                        </span>
                      </div>

                      {/* Meu status */}
                      <div className="mt-4 flex items-center gap-3">
                        {myStatus.status === "confirmado" && (
                          <span className="flex items-center gap-1.5 text-xs bg-green-400/20 text-green-300 px-3 py-1.5 rounded-full font-semibold">
                            ✅ Confirmado
                          </span>
                        )}
                        {myStatus.status === "espera" && (
                          <span className="flex items-center gap-1.5 text-xs bg-yellow-400/20 text-yellow-300 px-3 py-1.5 rounded-full font-semibold">
                            ⏳ Na espera
                          </span>
                        )}
                        {!myStatus.status && (
                          <span className="flex items-center gap-1.5 text-xs bg-white/10 text-white/50 px-3 py-1.5 rounded-full font-semibold">
                            ➕ Não inscrito
                          </span>
                        )}
                        {myStatus.pagamento_status === "pago" && (
                          <span className="flex items-center gap-1.5 text-xs bg-green-400/20 text-green-300 px-3 py-1.5 rounded-full font-semibold">
                            💳 Pago
                          </span>
                        )}
                        {myStatus.pagamento_status === "pendente" && (
                          <span className="flex items-center gap-1.5 text-xs bg-red-400/20 text-red-300 px-3 py-1.5 rounded-full font-semibold">
                            ⏰ Pagamento pendente
                          </span>
                        )}
                        {myStatus.multa_aplicada && (
                          <span className="flex items-center gap-1.5 text-xs bg-yellow-400/20 text-yellow-300 px-3 py-1.5 rounded-full font-semibold">
                            ⚠️ Multa
                          </span>
                        )}
                      </div>

                      {/* Stats rápidos */}
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {[
                          {
                            label: "Confirmados",
                            value: stats.confirmados,
                            icon: "👥",
                          },
                          {
                            label: "Na espera",
                            value: stats.espera,
                            icon: "⏳",
                          },
                          {
                            label: "Votos MVP",
                            value: stats.totalVotos,
                            icon: "🏅",
                          },
                        ].map(({ label, value, icon }) => (
                          <div
                            key={label}
                            className="rounded-2xl p-2.5 text-center bg-white/10"
                          >
                            <p className="text-base">{icon}</p>
                            <p className="font-display text-xl text-white leading-none mt-0.5">
                              {value}
                            </p>
                            <p className="text-white/40 text-[9px] mt-0.5 uppercase tracking-wider">
                              {label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ── Ações rápidas Admin ── */}
                  {isAdmin && (
                    <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-yellow-200 dark:border-yellow-800/40 shadow-sm">
                      <div className="px-4 py-3 border-b border-yellow-100 dark:border-yellow-800/30 flex items-center gap-2 bg-yellow-50 dark:bg-yellow-900/10">
                        <span className="text-base">⚙️</span>
                        <p className="text-xs font-bold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                          Painel Admin
                        </p>
                      </div>
                      <div className="p-3 grid grid-cols-3 gap-2">
                        {[
                          { href: "/admin", icon: "🏠", label: "Painel" },
                          {
                            href: "/admin/times",
                            icon: "🎲",
                            label: "Sortear",
                          },
                          {
                            href: "/admin/checkin",
                            icon: "✅",
                            label: "Checkin",
                          },
                          {
                            href: "/admin/financeiro",
                            icon: "💰",
                            label: "Financeiro",
                          },
                          {
                            href: "/admin/cobranca",
                            icon: "📲",
                            label: "Cobranças",
                          },
                          {
                            href: "/admin/comprovantes",
                            icon: "🧾",
                            label: "Comprovat.",
                          },
                        ].map(({ href, icon, label }) => (
                          <Link
                            key={href}
                            href={href}
                            className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-gray-50 dark:bg-gray-800 active:scale-95 transition-all"
                          >
                            <span className="text-xl">{icon}</span>
                            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 text-center">
                              {label}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Ações rápidas Gerente ── */}
                  {isGerente && !isAdmin && (
                    <div className="rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800/40 shadow-sm">
                      <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-800/30 flex items-center gap-2 bg-blue-50 dark:bg-blue-900/10">
                        <span className="text-base">💼</span>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                          Gestão
                        </p>
                      </div>
                      <div className="p-3 grid grid-cols-3 gap-2">
                        {[
                          {
                            href: "/admin/financeiro",
                            icon: "💰",
                            label: "Financeiro",
                          },
                          {
                            href: "/admin/cobranca",
                            icon: "📲",
                            label: "Cobranças",
                          },
                          {
                            href: "/admin/comprovantes",
                            icon: "🧾",
                            label: "Comprovat.",
                          },
                        ].map(({ href, icon, label }) => (
                          <Link
                            key={href}
                            href={href}
                            className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-gray-50 dark:bg-gray-800 active:scale-95 transition-all"
                          >
                            <span className="text-xl">{icon}</span>
                            <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 text-center">
                              {label}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Cards de navegação ── */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Lista */}
                    <NavCard
                      href="/lista"
                      icon="📋"
                      title="Lista"
                      desc={
                        myStatus.status === "confirmado"
                          ? "Você está confirmado"
                          : myStatus.status === "espera"
                            ? "Você está na espera"
                            : `${stats.confirmados}/20 vagas`
                      }
                      badge={
                        myStatus.status === "confirmado"
                          ? { label: "✅", color: "green" }
                          : undefined
                      }
                    />

                    {/* Times */}
                    <NavCard
                      href="/jogo/times"
                      icon="⚽"
                      title="Times"
                      desc={
                        game.sorteio_confirmado
                          ? "Times confirmados"
                          : "Sorteio pendente"
                      }
                      badge={
                        game.sorteio_confirmado
                          ? { label: "Oficial", color: "blue" }
                          : { label: "Pendente", color: "gray" }
                      }
                      locked={!game.sorteio_confirmado}
                    />

                    {/* Votação MVP */}
                    <NavCard
                      href="/votacao"
                      icon="🏅"
                      title="Votar MVP"
                      desc={
                        stats.meuVoto
                          ? "Você já votou"
                          : game.votacao_encerrada
                            ? "Encerrada"
                            : `${stats.totalVotos} votos`
                      }
                      badge={
                        stats.meuVoto
                          ? { label: "Votado", color: "green" }
                          : game.votacao_encerrada
                            ? { label: "Encerrada", color: "gray" }
                            : undefined
                      }
                    />

                    {/* Artilheiros */}
                    <NavCard
                      href="/jogo/artilheiro"
                      icon="🥅"
                      title="Artilheiros"
                      desc={
                        stats.topArtilheiro
                          ? `${stats.topArtilheiro} (${stats.gols}g)`
                          : "Nenhum gol ainda"
                      }
                    />

                    {/* Pagamento */}
                    <NavCard
                      href="/pagamento"
                      icon="💳"
                      title="Pagamento"
                      desc={
                        myStatus.pagamento_status === "pago"
                          ? "Em dia ✅"
                          : myStatus.multa_aplicada
                            ? "Multa aplicada ⚠️"
                            : "Pendente"
                      }
                      badge={
                        myStatus.pagamento_status === "pago"
                          ? { label: "Pago", color: "green" }
                          : myStatus.multa_aplicada
                            ? { label: "+20%", color: "yellow" }
                            : { label: "Pagar", color: "red" }
                      }
                    />

                    {/* Ranking */}
                    <NavCard
                      href="/ranking"
                      icon="🏆"
                      title="Ranking"
                      desc="Stars · MVP · Gols"
                    />

                    {/* Regras */}
                    <NavCard
                      href="/regras"
                      icon="📜"
                      title="Regras"
                      desc="Do grupo"
                    />

                    {/* Telão */}
                    <NavCard
                      href="/telao"
                      icon="📺"
                      title="Telão"
                      desc="Ver ao vivo"
                      fullscreen
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}

// ── NavCard ────────────────────────────────────────
function NavCard({
  href,
  icon,
  title,
  desc,
  badge,
  locked,
  fullscreen,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
  badge?: {
    label: string;
    color: "green" | "blue" | "red" | "yellow" | "gray";
  };
  locked?: boolean;
  fullscreen?: boolean;
}) {
  const BADGE_COLORS = {
    green:
      "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    blue: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    red: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
    yellow:
      "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
    gray: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  };

  return (
    <Link
      href={href}
      target={fullscreen ? "_blank" : undefined}
      className={`flex flex-col gap-2 p-4 rounded-2xl border bg-white dark:bg-gray-900 shadow-sm active:scale-[0.97] transition-all ${
        locked
          ? "border-gray-100 dark:border-gray-800 opacity-60"
          : "border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800"
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="text-2xl">{locked ? "🔒" : icon}</span>
        {badge && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${BADGE_COLORS[badge.color]}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div>
        <p className="font-bold text-sm text-gray-900 dark:text-white">
          {title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 leading-tight">{desc}</p>
      </div>
    </Link>
  );
}
