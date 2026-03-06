"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

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
  users?: { nome: string };
  games?: { data_jogo: string };
}

export default function AdminComprovantesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Comprovante[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<
    "aguardando_analise" | "todos" | "aprovado" | "rejeitado"
  >("aguardando_analise");

  useEffect(() => {
    loadData();
  }, [filtro]);

  async function loadData() {
    setLoading(true);
    let query = supabase
      .from("game_players")
      .select(`*, users(nome), games(data_jogo)`)
      .not("comprovante_url", "is", null)
      .order("comprovante_enviado_em", { ascending: false });

    if (filtro !== "todos") {
      query = query.eq("comprovante_status", filtro);
    }

    const { data } = await query;
    setItems(data ?? []);
    setLoading(false);
  }

  async function aprovar(id: string, valorPago?: number) {
    setActionLoading(id);
    await supabase.rpc("aprovar_comprovante", {
      p_game_player_id: id,
      p_valor_pago: valorPago ?? null,
      p_observacao: "Aprovado pelo admin",
    });
    await loadData();
    setActionLoading(null);
  }

  async function rejeitar(id: string) {
    const motivo = prompt("Motivo da rejeição:");
    if (!motivo) return;
    setActionLoading(id);
    await supabase.rpc("rejeitar_comprovante", {
      p_game_player_id: id,
      p_motivo: motivo,
    });
    await loadData();
    setActionLoading(null);
  }

  async function getSignedUrl(path: string) {
    // Extrai o path relativo após /comprovantes/
    const relativePath = path.split("/comprovantes/")[1];
    if (!relativePath) {
      setSelectedImg(path);
      return;
    }
    const { data } = await supabase.storage
      .from("comprovantes")
      .createSignedUrl(relativePath, 60);
    setSelectedImg(data?.signedUrl ?? path);
  }

  const filtros: (typeof filtro)[] = [
    "aguardando_analise",
    "aprovado",
    "rejeitado",
    "todos",
  ];
  const filtroLabel: Record<string, string> = {
    aguardando_analise: "⏳ Aguardando",
    aprovado: "✅ Aprovados",
    rejeitado: "❌ Rejeitados",
    todos: "Todos",
  };

  return (
    <div className="min-h-screen bg-green-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-green-400 text-sm mb-3 flex items-center gap-1 hover:text-green-300"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold">Comprovantes PIX</h1>
          <p className="text-green-400 text-sm">
            Revisão e aprovação de pagamentos
          </p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {filtros.map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm transition-colors ${
                filtro === f
                  ? "bg-green-600 text-white"
                  : "bg-green-900/40 text-green-400 hover:bg-green-800/40"
              }`}
            >
              {filtroLabel[f]}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-green-900/30 rounded-2xl p-10 text-center text-green-500">
            Nenhum comprovante{" "}
            {filtro === "todos"
              ? "encontrado"
              : filtroLabel[filtro].toLowerCase()}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="bg-green-900/40 rounded-2xl overflow-hidden"
              >
                {/* Topo */}
                <div className="p-4 flex items-start gap-4">
                  {/* Thumbnail */}
                  <button
                    onClick={() => getSignedUrl(item.comprovante_url!)}
                    className="w-16 h-16 rounded-xl overflow-hidden bg-green-800 flex-shrink-0 hover:opacity-80 transition-opacity"
                  >
                    <img
                      src={item.comprovante_url}
                      alt="Comprovante"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23166534' width='64' height='64'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2386efac' font-size='24'%3E📄%3C/text%3E%3C/svg%3E";
                      }}
                    />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">
                        {item.users?.nome}
                      </p>
                      <ComprobanteStatusBadge
                        status={item.comprovante_status}
                      />
                    </div>
                    <p className="text-green-400 text-sm">
                      {formatTipo(item.tipo)}
                    </p>
                    {item.comprovante_enviado_em && (
                      <p className="text-green-600 text-xs mt-0.5">
                        Enviado em{" "}
                        {new Date(item.comprovante_enviado_em).toLocaleString(
                          "pt-BR",
                        )}
                      </p>
                    )}
                    {item.multa_aplicada && (
                      <span className="text-xs text-red-400">⚠️ Tem multa</span>
                    )}
                    {item.comprovante_observacao && (
                      <p className="text-xs text-green-500 mt-1 italic">
                        {item.comprovante_observacao}
                      </p>
                    )}
                  </div>
                </div>

                {/* Ações (apenas para aguardando) */}
                {item.comprovante_status === "aguardando_analise" && (
                  <div className="border-t border-green-800 flex">
                    <button
                      onClick={() => rejeitar(item.id)}
                      disabled={actionLoading === item.id}
                      className="flex-1 py-3 text-red-400 hover:bg-red-900/20 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {actionLoading === item.id ? "..." : "✕ Rejeitar"}
                    </button>
                    <div className="w-px bg-green-800" />
                    <button
                      onClick={() => aprovar(item.id)}
                      disabled={actionLoading === item.id}
                      className="flex-1 py-3 text-green-400 hover:bg-green-800/30 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {actionLoading === item.id ? "..." : "✓ Aprovar"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de imagem */}
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
    </div>
  );
}

function ComprobanteStatusBadge({ status }: { status?: string }) {
  if (status === "aprovado")
    return (
      <span className="bg-green-700/60 text-green-300 text-xs px-2 py-0.5 rounded-full">
        ✓ Aprovado
      </span>
    );
  if (status === "rejeitado")
    return (
      <span className="bg-red-700/60 text-red-300 text-xs px-2 py-0.5 rounded-full">
        ✕ Rejeitado
      </span>
    );
  if (status === "aguardando_analise")
    return (
      <span className="bg-yellow-700/60 text-yellow-300 text-xs px-2 py-0.5 rounded-full">
        ⏳ Pendente
      </span>
    );
  return null;
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
