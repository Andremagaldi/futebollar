"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";

interface Comprovante {
  id: string;
  user_id: string;
  game_id: string;
  tipo: string;
  payment_status: string;
  multa_aplicada: boolean;
  comprovante_url?: string;
  comprovante_status?: string;
  comprovante_observacao?: string;
  comprovante_enviado_em?: string;
  valor_pago?: number;
  users?: { nome_completo: string };
  games?: { data_jogo: string };
}

type Filtro = "aguardando_analise" | "aprovado" | "rejeitado" | "todos";

const FILTROS: Filtro[] = [
  "aguardando_analise",
  "aprovado",
  "rejeitado",
  "todos",
];
const FILTRO_LABEL: Record<Filtro, string> = {
  aguardando_analise: "⏳ Aguardando",
  aprovado: "✅ Aprovados",
  rejeitado: "❌ Rejeitados",
  todos: "Todos",
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

function StatusBadge({ status }: { status?: string }) {
  if (status === "aprovado")
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400">
        ✓ Aprovado
      </span>
    );
  if (status === "rejeitado")
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400">
        ✕ Rejeitado
      </span>
    );
  if (status === "aguardando_analise")
    return (
      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
        ⏳ Pendente
      </span>
    );
  return null;
}

export default function AdminComprovantesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Comprovante[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("aguardando_analise");
  const [motivoRejeicao, setMotivoRejeicao] = useState<{
    id: string;
    motivo: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [filtro]);

  async function loadData() {
    setLoading(true);
    let query = supabase
      .from("game_players")
      .select("*, users(nome_completo), games(data_jogo)")
      .not("comprovante_url", "is", null)
      .order("comprovante_enviado_em", { ascending: false });
    if (filtro !== "todos") query = query.eq("comprovante_status", filtro);
    const { data } = await query;
    setItems(data ?? []);
    setLoading(false);
  }

  async function aprovar(id: string) {
    setActionLoading(id);
    await supabase.rpc("aprovar_comprovante", {
      p_game_player_id: id,
      p_valor_pago: null,
      p_observacao: "Aprovado pelo admin",
    });
    await loadData();
    setActionLoading(null);
  }

  async function confirmarRejeicao() {
    if (!motivoRejeicao || !motivoRejeicao.motivo.trim()) return;
    setActionLoading(motivoRejeicao.id);
    await supabase.rpc("rejeitar_comprovante", {
      p_game_player_id: motivoRejeicao.id,
      p_motivo: motivoRejeicao.motivo,
    });
    setMotivoRejeicao(null);
    await loadData();
    setActionLoading(null);
  }

  async function getSignedUrl(url: string) {
    const relativePath = url.split("/comprovantes/")[1];
    if (!relativePath) {
      setSelectedImg(url);
      return;
    }
    const { data } = await supabase.storage
      .from("comprovantes")
      .createSignedUrl(relativePath, 60);
    setSelectedImg(data?.signedUrl ?? url);
  }

  const aguardandoCount = items.filter(
    (i) => i.comprovante_status === "aguardando_analise",
  ).length;

  return (
    <ProtectedRoute requiredRole="gerente">
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
                COMPROVANTES
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {aguardandoCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
                {aguardandoCount} pendente{aguardandoCount !== 1 ? "s" : ""}
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
          {/* ── Filtros ── */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {FILTROS.map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold transition-all flex-shrink-0 ${
                  filtro === f
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                {FILTRO_LABEL[f]}
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
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-5xl mb-4">📭</p>
              <p className="font-display text-xl text-gray-900 dark:text-white">
                NENHUM COMPROVANTE
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {FILTRO_LABEL[filtro]}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden"
                >
                  {/* Info */}
                  <div className="p-4 flex items-start gap-4">
                    {/* Thumbnail */}
                    <button
                      onClick={() =>
                        item.comprovante_url &&
                        getSignedUrl(item.comprovante_url)
                      }
                      className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 hover:opacity-80 active:scale-95 transition-all"
                    >
                      <img
                        src={item.comprovante_url}
                        alt="Comprovante"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23e5e7eb' width='64' height='64'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='24'%3E📄%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-bold text-gray-900 dark:text-white truncate">
                          {item.users?.nome_completo ?? "—"}
                        </p>
                        <StatusBadge status={item.comprovante_status} />
                      </div>
                      <p className="text-gray-400 text-xs">
                        {formatTipo(item.tipo)}
                      </p>
                      {item.comprovante_enviado_em && (
                        <p className="text-gray-400 text-xs mt-0.5">
                          {new Date(item.comprovante_enviado_em).toLocaleString(
                            "pt-BR",
                          )}
                        </p>
                      )}
                      {item.multa_aplicada && (
                        <p className="text-xs text-red-500 mt-1 font-semibold">
                          ⚠️ Tem multa
                        </p>
                      )}
                      {item.comprovante_observacao && (
                        <p className="text-xs text-gray-400 mt-1 italic">
                          {item.comprovante_observacao}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  {item.comprovante_status === "aguardando_analise" && (
                    <div className="border-t border-gray-100 dark:border-gray-800 grid grid-cols-2">
                      <button
                        onClick={() =>
                          setMotivoRejeicao({ id: item.id, motivo: "" })
                        }
                        disabled={actionLoading === item.id}
                        className="py-3.5 flex items-center justify-center gap-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 text-sm font-semibold transition-colors disabled:opacity-50 border-r border-gray-100 dark:border-gray-800 active:scale-95"
                      >
                        {actionLoading === item.id ? <Spinner /> : "✕ Rejeitar"}
                      </button>
                      <button
                        onClick={() => aprovar(item.id)}
                        disabled={actionLoading === item.id}
                        className="py-3.5 flex items-center justify-center gap-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 text-sm font-semibold transition-colors disabled:opacity-50 active:scale-95"
                      >
                        {actionLoading === item.id ? <Spinner /> : "✓ Aprovar"}
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

      {/* ── Modal imagem ── */}
      {selectedImg && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImg(null)}
        >
          <div
            className="relative max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImg}
              alt="Comprovante ampliado"
              className="max-w-[90vw] max-h-[85vh] rounded-2xl object-contain"
            />
            <button
              onClick={() => setSelectedImg(null)}
              className="absolute top-3 right-3 bg-black/60 rounded-full w-9 h-9 flex items-center justify-center text-white hover:bg-black/80"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Modal rejeição ── */}
      {motivoRejeicao && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4"
          onClick={() => setMotivoRejeicao(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-gray-900 dark:text-white">
              Motivo da rejeição
            </h2>
            <textarea
              value={motivoRejeicao.motivo}
              onChange={(e) =>
                setMotivoRejeicao({ ...motivoRejeicao, motivo: e.target.value })
              }
              placeholder="Ex: Comprovante ilegível, valor incorreto..."
              rows={3}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setMotivoRejeicao(null)}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 text-sm font-semibold active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarRejeicao}
                disabled={!motivoRejeicao.motivo.trim() || !!actionLoading}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}
