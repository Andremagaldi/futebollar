"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface Pedido {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string | null;
  posicao: string;
  tipo: string;
  status: string;
  criado_em: string;
}

function formatTipo(tipo: string) {
  const map: Record<string, string> = {
    avulso: "Avulso",
    mensalista: "Mensalista",
    avulso_membro: "Avulso",
    mensalista_membro: "Mensalista",
  };
  return map[tipo] ?? tipo;
}

function formatRelativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

export default function AdminPedidosPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"pendente" | "aprovado" | "rejeitado">(
    "pendente",
  );

  useEffect(() => {
    loadPedidos();
  }, [filtro]);

  async function loadPedidos() {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select(
        "id, nome_completo, email, telefone, posicao, tipo, status, criado_em",
      )
      .eq("status", filtro)
      .order("criado_em", { ascending: false });
    setPedidos(data ?? []);
    setLoading(false);
  }

  async function aprovar(pedido: Pedido) {
    setActionId(pedido.id);
    await supabase
      .from("users")
      .update({ status: "ativo" })
      .eq("id", pedido.id);

    // Notifica o jogador via WhatsApp se tiver telefone
    if (pedido.telefone) {
      const nome = pedido.nome_completo.split(" ")[0];
      const msg = encodeURIComponent(
        `Olá ${nome}! ✅ Seu cadastro no Futebol Lar Cristão foi aprovado! Acesse o app e garanta sua vaga: ${window.location.origin}`,
      );
      window.open(
        `https://wa.me/55${pedido.telefone.replace(/\D/g, "")}?text=${msg}`,
        "_blank",
      );
    }

    await loadPedidos();
    setActionId(null);
  }

  async function rejeitar(id: string) {
    setActionId(id);
    await supabase.from("users").update({ status: "rejeitado" }).eq("id", id);
    await loadPedidos();
    setActionId(null);
  }

  const FILTROS = [
    { key: "pendente" as const, label: "⏳ Pendentes" },
    { key: "aprovado" as const, label: "✅ Aprovados" },
    { key: "rejeitado" as const, label: "❌ Rejeitados" },
  ];

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
              <p className="text-xs text-gray-400 uppercase tracking-widest">
                Admin
              </p>
              <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
                PEDIDOS
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!loading && filtro === "pendente" && pedidos.length > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                {pedidos.length} novo{pedidos.length !== 1 ? "s" : ""}
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
          {/* ── Filtros ── */}
          <div className="flex gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                  filtro === f.key
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-500"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ── Lista ── */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : pedidos.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-5xl mb-4">
                {filtro === "pendente" ? "🎉" : "📭"}
              </p>
              <p className="font-display text-xl text-gray-900 dark:text-white">
                {filtro === "pendente" ? "NENHUM PENDENTE" : "NENHUM CADASTRO"}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {filtro === "pendente"
                  ? "Todos os cadastros foram revisados!"
                  : "Nenhum cadastro encontrado."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pedidos.map((p) => (
                <div
                  key={p.id}
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">
                          {p.nome_completo}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.email}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatRelativo(p.criado_em)}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                        {p.posicao === "goleiro" ? "🧤 Goleiro" : "⚽ Linha"}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                        {formatTipo(p.tipo)}
                      </span>
                      {p.telefone && (
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                          📱 {p.telefone}
                        </span>
                      )}
                    </div>
                  </div>

                  {filtro === "pendente" && (
                    <div className="border-t border-gray-100 dark:border-gray-800 grid grid-cols-2">
                      <button
                        onClick={() => rejeitar(p.id)}
                        disabled={actionId === p.id}
                        className="py-3.5 flex items-center justify-center gap-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 text-sm font-semibold transition-colors disabled:opacity-50 border-r border-gray-100 dark:border-gray-800 active:scale-95"
                      >
                        {actionId === p.id ? <Spinner /> : "✕ Rejeitar"}
                      </button>
                      <button
                        onClick={() => aprovar(p)}
                        disabled={actionId === p.id}
                        className="py-3.5 flex items-center justify-center gap-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 text-sm font-semibold transition-colors disabled:opacity-50 active:scale-95"
                      >
                        {actionId === p.id ? <Spinner /> : "✓ Aprovar"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}
