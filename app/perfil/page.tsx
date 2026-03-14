"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface Convite {
  id: string;
  token: string;
  nome_destinatario: string | null;
  usado: boolean;
  expira_em: string;
  criado_em: string;
}

interface Pedido {
  id: string;
  nome_completo: string;
  telefone: string;
  email: string | null;
  posicao: string;
  categoria: string;
  tipo: string;
  status: string;
  criado_em: string;
  observacao: string | null;
  convites: { token: string } | null;
}

type Aba = "pedidos" | "convites";

export default function AdminConvitesPage() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("pedidos");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [acao, setAcao] = useState<string | null>(null);
  const [nomeConvite, setNomeConvite] = useState("");
  const [criandoConvite, setCriandoConvite] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<
    "pendente" | "aprovado" | "rejeitado"
  >("pendente");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }
    setAdminId(user.id);
    await Promise.all([loadPedidos(), loadConvites()]);
    setLoading(false);
  }

  async function loadPedidos() {
    const { data } = await supabase
      .from("pedidos_entrada")
      .select("*, convites(token)")
      .order("criado_em", { ascending: false });
    setPedidos((data as Pedido[]) ?? []);
  }

  async function loadConvites() {
    const { data } = await supabase
      .from("convites")
      .select("*")
      .order("criado_em", { ascending: false });
    setConvites(data ?? []);
  }

  async function criarConvite() {
    if (!adminId) return;
    setCriandoConvite(true);
    const { data } = await supabase
      .from("convites")
      .insert({ criado_por: adminId, nome_destinatario: nomeConvite || null })
      .select()
      .single();
    if (data) {
      setNomeConvite("");
      await loadConvites();
      copiarLink(data.token);
    }
    setCriandoConvite(false);
  }

  function copiarLink(token: string) {
    const url = `${window.location.origin}/convite/${token}`;
    navigator.clipboard.writeText(url);
    setLinkCopiado(token);
    setTimeout(() => setLinkCopiado(null), 2500);
  }

  function compartilharWhatsApp(token: string, nome: string | null) {
    const url = `${window.location.origin}/convite/${token}`;
    const msg = `Olá${nome ? ` ${nome}` : ""}! ⚽ Você foi convidado para o Futebol Lar Cristão. Clique no link para se cadastrar: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function aprovar(pedido: Pedido) {
    if (!adminId) return;
    setAcao(pedido.id + "aprovar");
    await supabase.rpc("aprovar_pedido", {
      p_pedido_id: pedido.id,
      p_admin_id: adminId,
    });
    await loadPedidos();
    setAcao(null);
  }

  async function rejeitar(pedido: Pedido) {
    if (!adminId) return;
    const motivo = prompt("Motivo da rejeição (opcional):");
    setAcao(pedido.id + "rejeitar");
    await supabase.rpc("rejeitar_pedido", {
      p_pedido_id: pedido.id,
      p_admin_id: adminId,
      p_motivo: motivo ?? null,
    });
    await loadPedidos();
    setAcao(null);
  }

  const pedidosFiltrados = pedidos.filter((p) => p.status === filtroStatus);
  const pendentesCount = pedidos.filter((p) => p.status === "pendente").length;

  return (
    <div className="min-h-screen bg-green-950 text-white px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-green-400 text-sm mb-3 flex items-center gap-1 hover:text-green-300"
          >
            ← Voltar
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Convites</h1>
              <p className="text-green-400 text-sm">
                Gerenciar entradas no grupo
              </p>
            </div>
            {pendentesCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {pendentesCount} pendente{pendentesCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {(
            [
              { key: "pedidos", label: "📋 Pedidos" },
              { key: "convites", label: "🔗 Links" },
            ] as { key: Aba; label: string }[]
          ).map((a) => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                aba === a.key
                  ? "bg-green-700 border-green-600 text-white"
                  : "bg-green-900/30 border-green-800/40 text-green-400"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ABA: PEDIDOS */}
            {aba === "pedidos" && (
              <div>
                <div className="flex gap-2 mb-4">
                  {(["pendente", "aprovado", "rejeitado"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFiltroStatus(s)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        filtroStatus === s
                          ? "bg-green-700 text-white"
                          : "bg-green-900/30 text-green-500"
                      }`}
                    >
                      {s === "pendente"
                        ? "⏳ Pendentes"
                        : s === "aprovado"
                          ? "✅ Aprovados"
                          : "❌ Rejeitados"}
                    </button>
                  ))}
                </div>

                {pedidosFiltrados.length === 0 ? (
                  <div className="bg-green-900/20 rounded-2xl p-10 text-center text-green-600">
                    Nenhum pedido {filtroStatus}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pedidosFiltrados.map((p) => (
                      <div
                        key={p.id}
                        className="bg-green-900/40 border border-green-800/40 rounded-2xl overflow-hidden"
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="font-semibold text-white">
                                {p.nome_completo}
                              </p>
                              <p className="text-green-500 text-xs">
                                📱 {p.telefone}
                              </p>
                              {p.email && (
                                <p className="text-green-600 text-xs">
                                  ✉️ {p.email}
                                </p>
                              )}
                            </div>
                            <StatusBadge status={p.status} />
                          </div>
                          <div className="flex gap-2 flex-wrap mt-2">
                            <Tag
                              label={
                                p.posicao === "goleiro"
                                  ? "🧤 Goleiro"
                                  : "⚽ Linha"
                              }
                            />
                            <Tag
                              label={
                                p.categoria === "convidado"
                                  ? "🎟️ Convidado"
                                  : "👤 Membro"
                              }
                            />
                            <Tag
                              label={
                                p.tipo === "mensalista"
                                  ? "📅 Mensalista"
                                  : "💳 Avulso"
                              }
                            />
                          </div>
                          <p className="text-green-700 text-xs mt-2">
                            {formatData(p.criado_em)}
                          </p>
                          {p.observacao && (
                            <p className="text-red-400 text-xs mt-1 italic">
                              {p.observacao}
                            </p>
                          )}
                        </div>

                        {p.status === "pendente" && (
                          <div className="border-t border-green-800/40 grid grid-cols-2">
                            <button
                              onClick={() => rejeitar(p)}
                              disabled={!!acao}
                              className="py-3 text-red-400 hover:bg-red-900/20 text-sm font-medium transition-colors border-r border-green-800/40 disabled:opacity-50"
                            >
                              {acao === p.id + "rejeitar"
                                ? "..."
                                : "✕ Rejeitar"}
                            </button>
                            <button
                              onClick={() => aprovar(p)}
                              disabled={!!acao}
                              className="py-3 text-green-400 hover:bg-green-800/30 text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {acao === p.id + "aprovar" ? "..." : "✓ Aprovar"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ABA: LINKS */}
            {aba === "convites" && (
              <div>
                {/* Criar novo link */}
                <div className="bg-green-900/40 border border-green-800/40 rounded-2xl p-4 mb-4">
                  <p className="text-green-400 text-sm mb-3">
                    🔗 Criar novo link de convite
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={nomeConvite}
                      onChange={(e) => setNomeConvite(e.target.value)}
                      placeholder="Nome do convidado (opcional)"
                      className="flex-1 bg-green-950 border border-green-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-green-700 focus:outline-none focus:border-green-500"
                    />
                    <button
                      onClick={criarConvite}
                      disabled={criandoConvite}
                      className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {criandoConvite ? "..." : "Criar"}
                    </button>
                  </div>
                </div>

                {convites.length === 0 ? (
                  <div className="bg-green-900/20 rounded-2xl p-10 text-center text-green-600">
                    Nenhum convite criado ainda
                  </div>
                ) : (
                  <div className="space-y-2">
                    {convites.map((c) => (
                      <div
                        key={c.id}
                        className="bg-green-900/40 border border-green-800/40 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {c.nome_destinatario ?? "Convite geral"}
                            </p>
                            <p className="text-green-600 text-xs font-mono truncate">
                              /convite/{c.token.slice(0, 16)}...
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            {c.usado ? (
                              <span className="bg-green-800/60 text-green-400 text-xs px-2 py-0.5 rounded-full">
                                ✓ Usado
                              </span>
                            ) : new Date(c.expira_em) < new Date() ? (
                              <span className="bg-red-900/60 text-red-400 text-xs px-2 py-0.5 rounded-full">
                                Expirado
                              </span>
                            ) : (
                              <span className="bg-yellow-900/60 text-yellow-400 text-xs px-2 py-0.5 rounded-full">
                                Ativo
                              </span>
                            )}
                          </div>
                        </div>
                        {!c.usado && new Date(c.expira_em) >= new Date() && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => copiarLink(c.token)}
                              className="flex-1 py-2 rounded-lg bg-green-800/40 text-green-400 hover:bg-green-700/40 text-xs transition-colors"
                            >
                              {linkCopiado === c.token
                                ? "✓ Copiado!"
                                : "📋 Copiar link"}
                            </button>
                            <button
                              onClick={() =>
                                compartilharWhatsApp(
                                  c.token,
                                  c.nome_destinatario,
                                )
                              }
                              className="flex-1 py-2 rounded-lg bg-green-800/40 text-green-400 hover:bg-green-700/40 text-xs transition-colors"
                            >
                              📲 WhatsApp
                            </button>
                          </div>
                        )}
                        <p className="text-green-700 text-xs mt-2">
                          Expira em{" "}
                          {new Date(c.expira_em).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pendente: "bg-yellow-800/60 text-yellow-300",
    aprovado: "bg-green-800/60 text-green-300",
    rejeitado: "bg-red-800/60 text-red-300",
  };
  const label: Record<string, string> = {
    pendente: "⏳ Pendente",
    aprovado: "✅ Aprovado",
    rejeitado: "❌ Rejeitado",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${map[status]}`}
    >
      {label[status] ?? status}
    </span>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="bg-green-900/60 text-green-400 text-xs px-2 py-0.5 rounded-full">
      {label}
    </span>
  );
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
