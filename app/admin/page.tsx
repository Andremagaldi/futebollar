"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRole } from "@/hooks/useRole";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface GameStats {
  id: string;
  data_jogo: string;
  status_lista: string;
  sorteio_confirmado: boolean;
  confirmados: number;
  espera: number;
  pagos: number;
  pendentes: number;
  comprovantes_pendentes: number;
  pedidos_pendentes: number;
}

export default function AdminPage() {
  const { isAdmin, loading: roleLoading } = useRole();
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading) fetchStats();
  }, [roleLoading]);

  async function fetchStats() {
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
    const g = games[0];

    const { data: players } = await supabase
      .from("game_players")
      .select("status, pagamento_status")
      .eq("game_id", g.id);

    const confirmados =
      players?.filter((p) => p.status === "confirmado").length ?? 0;
    const espera = players?.filter((p) => p.status === "espera").length ?? 0;
    const pagos =
      players?.filter((p) => p.pagamento_status === "pago").length ?? 0;
    const pendentes =
      players?.filter(
        (p) => p.status === "confirmado" && p.pagamento_status !== "pago",
      ).length ?? 0;

    // Comprovantes aguardando revisão (via game_players)
    const { count: compPendentes } = await supabase
      .from("game_players")
      .select("*", { count: "exact", head: true })
      .eq("game_id", g.id)
      .eq("comprovante_status", "aguardando_analise");

    // Cadastros pendentes de aprovação
    const { count: pedidosPendentes } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("status", "pendente");

    setStats({
      id: g.id,
      data_jogo: g.data_jogo,
      status_lista: g.status_lista,
      sorteio_confirmado: g.sorteio_confirmado,
      confirmados,
      espera,
      pagos,
      pendentes,
      comprovantes_pendentes: compPendentes ?? 0,
      pedidos_pendentes: pedidosPendentes ?? 0,
    });
    setLoading(false);
  }

  function formatData(d: string) {
    return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  }

  async function toggleLista() {
    if (!stats) return;
    const novoStatus = stats.status_lista === "aberta" ? "fechada" : "aberta";
    await supabase
      .from("games")
      .update({ status_lista: novoStatus })
      .eq("id", stats.id);
    setStats((prev) => (prev ? { ...prev, status_lista: novoStatus } : prev));
  }

  const MODULOS = [
    {
      href: "/admin/times",
      icon: "🎲",
      title: "Sortear Times",
      desc: "Gerar e confirmar sorteio",
      badge: stats?.sorteio_confirmado
        ? { label: "Confirmado", color: "green" }
        : { label: "Pendente", color: "yellow" },
      alert: false,
    },
    {
      href: "/admin/checkin",
      icon: "✅",
      title: "Checkin",
      desc: "Presença no dia do jogo",
      badge: null,
      alert: false,
    },
    {
      href: "/admin/comprovantes",
      icon: "🧾",
      title: "Comprovantes",
      desc: "Aprovar pagamentos PIX",
      badge: stats?.comprovantes_pendentes
        ? { label: `${stats.comprovantes_pendentes} pend.`, color: "red" }
        : { label: "Em dia", color: "green" },
      alert: (stats?.comprovantes_pendentes ?? 0) > 0,
    },
    {
      href: "/admin/financeiro",
      icon: "💰",
      title: "Financeiro",
      desc: "Pagamentos e multas",
      badge: stats?.pendentes
        ? { label: `${stats.pendentes} pend.`, color: "red" }
        : { label: "Em dia", color: "green" },
      alert: (stats?.pendentes ?? 0) > 0,
    },
    {
      href: "/admin/cobranca",
      icon: "📲",
      title: "Cobranças",
      desc: "Lembretes via WhatsApp",
      badge: stats?.pendentes
        ? { label: `${stats.pendentes} a cobrar`, color: "yellow" }
        : null,
      alert: false,
    },
    {
      href: "/admin/convites",
      icon: "🔗",
      title: "Convites",
      desc: "Gerenciar acesso",
      badge: null,
      alert: false,
    },
    {
      href: "/admin/pedidos",
      icon: "👥",
      title: "Pedidos",
      desc: "Aprovar novos cadastros",
      badge: stats?.pedidos_pendentes
        ? {
            label: `${stats.pedidos_pendentes} novo${stats.pedidos_pendentes > 1 ? "s" : ""}`,
            color: "red",
          }
        : { label: "Em dia", color: "green" },
      alert: (stats?.pedidos_pendentes ?? 0) > 0,
    },
    {
      href: "/admin/gerente",
      icon: "👔",
      title: "Gerentes",
      desc: "Promover usuários",
      badge: null,
      alert: false,
    },
    {
      href: "/lista",
      icon: "📋",
      title: "Lista",
      desc: "Ver e gerenciar lista",
      badge: stats ? { label: `${stats.confirmados}/20`, color: "blue" } : null,
      alert: false,
    },
  ];

  const BADGE_COLORS: Record<string, string> = {
    green:
      "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    blue: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
    red: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
    yellow:
      "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400",
    gray: "bg-gray-100 dark:bg-gray-800 text-gray-500",
  };

  return (
    <ProtectedRoute requiredRole="admin">
      <div className="min-h-screen pb-28 bg-gray-50 dark:bg-gray-950">
        {/* ── Header ── */}
        <header className="sticky top-0 z-40 px-4 py-4 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-yellow-500 uppercase tracking-widest font-semibold">
              ⚙️ Admin
            </p>
            <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
              PAINEL
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 active:scale-95 transition-all"
            >
              🔄
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
          {/* ── Loading ── */}
          {(loading || roleLoading) && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          )}

          {!loading && !roleLoading && (
            <>
              {/* ── Card da partida ── */}
              {stats && (
                <div className="rounded-3xl p-5 relative overflow-hidden bg-gradient-to-br from-gray-800 to-gray-950 shadow-xl border border-white/5">
                  <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-yellow-400 opacity-5" />
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white/40 text-xs uppercase tracking-widest mb-1">
                          Partida atual
                        </p>
                        <p className="font-display text-xl text-white capitalize leading-tight">
                          {formatData(stats.data_jogo)}
                        </p>
                      </div>
                      {/* Toggle lista */}
                      <button
                        onClick={toggleLista}
                        className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
                          stats.status_lista === "aberta"
                            ? "bg-green-500/20 border-green-500/40 text-green-400"
                            : "bg-gray-700 border-gray-600 text-gray-400"
                        }`}
                      >
                        {stats.status_lista === "aberta"
                          ? "🟢 Fechar lista"
                          : "🔴 Abrir lista"}
                      </button>
                    </div>

                    {/* Mini stats */}
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      {[
                        {
                          label: "Confirm.",
                          value: stats.confirmados,
                          icon: "👥",
                        },
                        { label: "Espera", value: stats.espera, icon: "⏳" },
                        { label: "Pagos", value: stats.pagos, icon: "✅" },
                        {
                          label: "Pendente",
                          value: stats.pendentes,
                          icon: "⏰",
                        },
                      ].map(({ label, value, icon }) => (
                        <div
                          key={label}
                          className="rounded-xl p-2 text-center bg-white/5"
                        >
                          <p className="text-sm">{icon}</p>
                          <p className="font-display text-lg text-white leading-none mt-0.5">
                            {value}
                          </p>
                          <p className="text-white/30 text-[9px] mt-0.5 uppercase tracking-wider">
                            {label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Alertas ── */}
              {(stats?.comprovantes_pendentes ?? 0) > 0 && (
                <Link
                  href="/admin/comprovantes"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 active:scale-[0.98] transition-all"
                >
                  <span className="text-2xl">🧾</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-red-700 dark:text-red-400">
                      {stats!.comprovantes_pendentes} comprovante
                      {stats!.comprovantes_pendentes > 1 ? "s" : ""} aguardando
                      revisão
                    </p>
                    <p className="text-xs text-red-400">Toque para revisar</p>
                  </div>
                  <span className="text-red-400 text-lg">→</span>
                </Link>
              )}

              {(stats?.pendentes ?? 0) > 0 && (
                <Link
                  href="/admin/cobranca"
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/40 active:scale-[0.98] transition-all"
                >
                  <span className="text-2xl">📲</span>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-yellow-700 dark:text-yellow-400">
                      {stats!.pendentes} jogador
                      {stats!.pendentes > 1 ? "es" : ""} com pagamento pendente
                    </p>
                    <p className="text-xs text-yellow-500">
                      Enviar lembretes via WhatsApp
                    </p>
                  </div>
                  <span className="text-yellow-400 text-lg">→</span>
                </Link>
              )}

              {/* ── Grid de módulos ── */}
              <div className="grid grid-cols-2 gap-3">
                {MODULOS.map(({ href, icon, title, desc, badge, alert }) => (
                  <Link
                    key={href}
                    href={href}
                    className="relative flex flex-col gap-2 p-4 rounded-2xl border bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm active:scale-[0.97] transition-all hover:border-blue-200 dark:hover:border-blue-800"
                  >
                    {/* Ponto vermelho de alerta */}
                    {alert && (
                      <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    )}

                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{icon}</span>
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
                      <p className="text-xs text-gray-400 mt-0.5 leading-tight">
                        {desc}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>

              {/* ── Link para ver como jogador ── */}
              <Link
                href="/jogo"
                className="flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors active:scale-[0.98]"
              >
                <span>👁️</span> Ver como jogador
              </Link>
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}
