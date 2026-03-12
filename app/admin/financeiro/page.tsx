"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRole } from "@/hooks/useRole";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useRouter } from "next/navigation";

// ── Tipos ──────────────────────────────────────────
interface FinanceUser {
  id: string;
  nome_completo: string;
  tipo: string;
}
interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string;
  status: string;
  payment_status: string;
  multa_aplicada: boolean;
  position: number | null;
  users: FinanceUser | null;
}
interface GameRow {
  id: string;
  data_jogo: string;
  total_players: number | null;
  total_arrecadado: number | null;
}
interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  comprovante_url: string | null;
  criado_em: string;
  observacao: string | null;
}
interface Resumo {
  total_entradas: number;
  total_saidas: number;
  saldo: number;
}

type Aba = "jogadores" | "despesas" | "nova_despesa" | "historico";

// ── Constantes ─────────────────────────────────────
const VALOR_MENSALISTA = 50;
const VALOR_AVULSO = 30;
const MULTA_PERCENTUAL = 0.2;

const CATEGORIAS = [
  { value: "equipamentos", label: "🏋️ Equipamentos" },
  { value: "jardinagem", label: "🌿 Jardinagem" },
  { value: "manutencao", label: "🔧 Manutenção" },
  { value: "alimentacao", label: "🍕 Alimentação" },
  { value: "outros", label: "📦 Outros" },
];

// ── Helpers ────────────────────────────────────────
function moeda(v: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);
}
function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function calcValor(tipo: string) {
  return tipo?.includes("mensalista") ? VALOR_MENSALISTA : VALOR_AVULSO;
}

export default function FinanceiroPage() {
  const router = useRouter();
  const { isGerente, loading: roleLoading } = useRole();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aba, setAba] = useState<Aba>("jogadores");
  const [jogadores, setJogadores] = useState<GamePlayer[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [resumo, setResumo] = useState<Resumo>({
    total_entradas: 0,
    total_saidas: 0,
    saldo: 0,
  });
  const [semanaAtual, setSemana] = useState<GameRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Form nova despesa
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("outros");
  const [observacao, setObservacao] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [salvandoDespesa, setSalvandoDespesa] = useState(false);
  const [salvoDespesa, setSalvoDespesa] = useState(false);

  useEffect(() => {
    if (!roleLoading) fetchAll();
  }, [roleLoading]);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchJogadores(), fetchDespesas()]);
    setLoading(false);
  }

  async function fetchJogadores() {
    const { data: gamesData } = await supabase
      .from("games")
      .select("*")
      .order("data_jogo", { ascending: false })
      .limit(8);
    const latest = gamesData?.[0] ?? null;
    setSemana(latest as GameRow | null);
    setGames((gamesData as GameRow[]) ?? []);
    if (!latest) return;

    const { data: playersData } = await supabase
      .from("game_players")
      .select("*, users(id, nome_completo, tipo)")
      .eq("game_id", latest.id)
      .order("position", { ascending: true });

    const norm = (playersData ?? []).map((j: any) => ({
      ...j,
      users: Array.isArray(j.users) ? (j.users[0] ?? null) : j.users,
    }));
    setJogadores(norm);

    // Calcular resumo
    const entradas = norm.reduce((acc: number, j: GamePlayer) => {
      return j.payment_status === "pago"
        ? acc + calcValor(j.users?.tipo ?? "")
        : acc;
    }, 0);
    const { data: despData } = await supabase.from("despesas").select("valor");
    const saidas = (despData ?? []).reduce(
      (acc: number, d: any) => acc + Number(d.valor),
      0,
    );
    setResumo({
      total_entradas: entradas,
      total_saidas: saidas,
      saldo: entradas - saidas,
    });
  }

  async function fetchDespesas() {
    const { data } = await supabase
      .from("despesas")
      .select("*")
      .order("criado_em", { ascending: false });
    setDespesas((data as Despesa[]) ?? []);
  }

  async function togglePagamento(gpId: string, statusAtual: string) {
    setSaving(gpId);
    await supabase
      .from("game_players")
      .update({ payment_status: statusAtual === "pago" ? "pendente" : "pago" })
      .eq("id", gpId);
    await fetchJogadores();
    setSaving(null);
  }

  async function toggleMulta(gpId: string, multaAtual: boolean, tipo: string) {
    if (!tipo?.includes("avulso")) return;
    setSaving(gpId);
    await supabase
      .from("game_players")
      .update({ multa_aplicada: !multaAtual })
      .eq("id", gpId);
    await fetchJogadores();
    setSaving(null);
  }

  // ── IA comprovante despesa ──────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPreview(base64);
      await analisarComIA(base64, file.type);
    };
    reader.readAsDataURL(file);
  }

  async function analisarComIA(base64: string, mediaType: string) {
    setAnalisando(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64.split(",")[1],
                  },
                },
                {
                  type: "text",
                  text: `Analise este comprovante de despesa e extraia as informações.\nResponda APENAS em JSON válido, sem markdown:\n{"descricao":"descrição do que foi comprado/pago","valor":número ou null,"categoria":"equipamentos" ou "jardinagem" ou "manutencao" ou "alimentacao" ou "outros","observacao":"detalhes adicionais ou null"}`,
                },
              ],
            },
          ],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text ?? "";
      const result = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (result.descricao) setDescricao(result.descricao);
      if (result.valor) setValor(String(result.valor));
      if (result.categoria) setCategoria(result.categoria);
      if (result.observacao) setObservacao(result.observacao);
    } catch {
      /* usuário preenche manualmente */
    }
    setAnalisando(false);
  }

  async function salvarDespesa() {
    if (!descricao || !valor) return;
    setSalvandoDespesa(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let comprovante_url = null;

    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop();
      const fileName = `despesa_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("despesas-comprovantes")
        .upload(fileName, selectedFile, { upsert: true });
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("despesas-comprovantes")
          .getPublicUrl(fileName);
        comprovante_url = urlData.publicUrl;
      }
    }

    await supabase.from("despesas").insert({
      descricao,
      valor: parseFloat(valor),
      categoria,
      observacao: observacao || null,
      comprovante_url,
      comprovante_status: comprovante_url ? "anexado" : "sem_comprovante",
      cadastrado_por: user?.id ?? null,
    });

    setDescricao("");
    setValor("");
    setCategoria("outros");
    setObservacao("");
    setPreview(null);
    setSelectedFile(null);
    setSalvandoDespesa(false);
    setSalvoDespesa(true);
    setTimeout(() => setSalvoDespesa(false), 2000);
    await fetchAll();
    setAba("despesas");
  }

  // ── Cálculos ───────────────────────────────────
  const confirmados = jogadores.filter((j) => j.status === "confirmado");
  const totalEsperado = confirmados.reduce(
    (acc, j) => acc + calcValor(j.users?.tipo ?? ""),
    0,
  );
  const totalPago = confirmados
    .filter((j) => j.payment_status === "pago")
    .reduce((acc, j) => acc + calcValor(j.users?.tipo ?? ""), 0);
  const totalPendente = totalEsperado - totalPago;
  const totalMultas = confirmados
    .filter((j) => j.multa_aplicada)
    .reduce(
      (acc, j) => acc + calcValor(j.users?.tipo ?? "") * MULTA_PERCENTUAL,
      0,
    );

  const ABAS: { key: Aba; label: string }[] = [
    { key: "jogadores", label: "👥 Jogadores" },
    { key: "despesas", label: "🔴 Despesas" },
    { key: "nova_despesa", label: "+ Despesa" },
    { key: "historico", label: "📅 Histórico" },
  ];

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
              <p className="text-xs text-yellow-500 uppercase tracking-widest font-semibold">
                Financeiro
              </p>
              <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
                {semanaAtual ? formatData(semanaAtual.data_jogo) : "SEM JOGO"}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAll}
              className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 active:scale-95 transition-all"
            >
              🔄
            </button>
            <ThemeToggle />
          </div>
        </header>

        <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : (
            <>
              {/* ── Cards resumo ── */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Esperado",
                    value: moeda(totalEsperado),
                    color: "blue",
                  },
                  {
                    label: "Arrecadado",
                    value: moeda(totalPago),
                    color: "green",
                  },
                  {
                    label: "Pendente",
                    value: moeda(totalPendente),
                    color: "red",
                  },
                  {
                    label: "Multas",
                    value: moeda(totalMultas),
                    color: "yellow",
                  },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className={`rounded-2xl p-4 border ${
                      color === "blue"
                        ? "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30"
                        : color === "green"
                          ? "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/30"
                          : color === "red"
                            ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30"
                            : "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-800/30"
                    }`}
                  >
                    <p
                      className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                        color === "blue"
                          ? "text-blue-500"
                          : color === "green"
                            ? "text-green-500"
                            : color === "red"
                              ? "text-red-500"
                              : "text-yellow-500"
                      }`}
                    >
                      {label}
                    </p>
                    <p
                      className={`font-display text-xl leading-none ${
                        color === "blue"
                          ? "text-blue-700 dark:text-blue-300"
                          : color === "green"
                            ? "text-green-700 dark:text-green-300"
                            : color === "red"
                              ? "text-red-700 dark:text-red-300"
                              : "text-yellow-700 dark:text-yellow-300"
                      }`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Saldo caixa */}
              <div
                className={`rounded-2xl p-4 border flex items-center justify-between ${
                  resumo.saldo >= 0
                    ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30"
                    : "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30"
                }`}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Saldo do caixa
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Entradas − Despesas
                  </p>
                </div>
                <p
                  className={`font-display text-2xl ${resumo.saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}
                >
                  {moeda(resumo.saldo)}
                </p>
              </div>

              {/* ── Abas ── */}
              <div className="flex gap-1 bg-gray-100 dark:bg-gray-900 rounded-2xl p-1 overflow-x-auto">
                {ABAS.map((a) => (
                  <button
                    key={a.key}
                    onClick={() => setAba(a.key)}
                    className={`flex-1 whitespace-nowrap py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
                      aba === a.key
                        ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {/* ── ABA: JOGADORES ── */}
              {aba === "jogadores" && (
                <div className="space-y-2">
                  {confirmados.length === 0 ? (
                    <Empty msg="Nenhum jogador confirmado" />
                  ) : (
                    confirmados.map((j) => {
                      const nome = j.users?.nome_completo ?? "—";
                      const tipo = j.users?.tipo ?? "";
                      const pago = j.payment_status === "pago";
                      const avulso = tipo.includes("avulso");
                      const isSaving = saving === j.id;

                      return (
                        <div
                          key={j.id}
                          className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm"
                        >
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                              {nome.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                              {nome}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-400">
                                {moeda(calcValor(tipo))}
                              </span>
                              {j.multa_aplicada && (
                                <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full font-semibold">
                                  +{moeda(calcValor(tipo) * MULTA_PERCENTUAL)}{" "}
                                  multa
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 flex-shrink-0 items-end">
                            {isSaving ? (
                              <Spinner />
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    togglePagamento(j.id, j.payment_status)
                                  }
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                    pago
                                      ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                                      : "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                                  }`}
                                >
                                  {pago ? "✅ Pago" : "⏰ Pendente"}
                                </button>
                                {avulso && (
                                  <button
                                    onClick={() =>
                                      toggleMulta(j.id, j.multa_aplicada, tipo)
                                    }
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                                      j.multa_aplicada
                                        ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                                    }`}
                                  >
                                    {j.multa_aplicada ? "⚠️ Multa" : "Multa"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── ABA: DESPESAS ── */}
              {aba === "despesas" && (
                <div className="space-y-2">
                  {despesas.length === 0 ? (
                    <Empty msg="Nenhuma despesa registrada" />
                  ) : (
                    despesas.map((d) => (
                      <div
                        key={d.id}
                        className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
                      >
                        <div className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">
                              {CATEGORIAS.find((c) => c.value === d.categoria)
                                ?.label ?? d.categoria}
                            </span>
                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate mt-1">
                              {d.descricao}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatData(d.criado_em)}
                            </p>
                            {d.observacao && (
                              <p className="text-xs text-gray-400 italic mt-0.5">
                                {d.observacao}
                              </p>
                            )}
                          </div>
                          <p className="text-red-600 dark:text-red-400 font-bold flex-shrink-0">
                            -{moeda(d.valor)}
                          </p>
                        </div>
                        {d.comprovante_url && (
                          <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-2">
                            <a
                              href={d.comprovante_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 text-xs hover:text-blue-400 flex items-center gap-1"
                            >
                              📎 Ver comprovante
                            </a>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── ABA: NOVA DESPESA ── */}
              {aba === "nova_despesa" && (
                <div className="space-y-4">
                  {/* Upload comprovante */}
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                      📎 Comprovante da despesa
                    </p>
                    {preview ? (
                      <div className="relative">
                        <img
                          src={preview}
                          alt="Comprovante"
                          className="w-full rounded-xl object-cover max-h-48"
                        />
                        <button
                          onClick={() => {
                            setPreview(null);
                            setSelectedFile(null);
                          }}
                          className="absolute top-2 right-2 bg-black/60 rounded-full w-7 h-7 flex items-center justify-center text-white text-sm"
                        >
                          ✕
                        </button>
                        {analisando && (
                          <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-2">
                            <Spinner />
                            <p className="text-white text-sm">
                              IA analisando comprovante...
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-300 transition-colors active:scale-[0.98]"
                      >
                        <span className="text-3xl">📎</span>
                        <span className="text-sm">Foto do comprovante</span>
                        <span className="text-xs text-gray-300 dark:text-gray-600">
                          A IA preenche os campos automaticamente
                        </span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>

                  {/* Formulário */}
                  <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 space-y-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Dados da despesa
                    </p>

                    <Campo label="Descrição *">
                      <input
                        type="text"
                        value={descricao}
                        onChange={(e) => setDescricao(e.target.value)}
                        placeholder="Ex: Compra de coletes novos"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-400 transition-colors"
                      />
                    </Campo>

                    <Campo label="Valor (R$) *">
                      <input
                        type="number"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-400 transition-colors"
                      />
                    </Campo>

                    <Campo label="Categoria">
                      <div className="grid grid-cols-2 gap-2">
                        {CATEGORIAS.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => setCategoria(c.value)}
                            className={`py-2 px-3 rounded-xl text-xs font-medium transition-all text-left border active:scale-95 ${
                              categoria === c.value
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </Campo>

                    <Campo label="Observação">
                      <textarea
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        placeholder="Detalhes adicionais..."
                        rows={2}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-400 transition-colors resize-none"
                      />
                    </Campo>

                    <button
                      onClick={salvarDespesa}
                      disabled={salvandoDespesa || !descricao || !valor}
                      className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {salvandoDespesa ? (
                        <>
                          <Spinner /> Salvando...
                        </>
                      ) : salvoDespesa ? (
                        "✅ Salvo!"
                      ) : (
                        "Registrar despesa"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ── ABA: HISTÓRICO ── */}
              {aba === "historico" && (
                <div className="space-y-2">
                  {games.length === 0 ? (
                    <Empty msg="Sem histórico de jogos" />
                  ) : (
                    games.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm"
                      >
                        <div>
                          <p className="font-semibold text-sm text-gray-900 dark:text-white capitalize">
                            {new Date(
                              g.data_jogo + "T12:00:00",
                            ).toLocaleDateString("pt-BR", {
                              weekday: "long",
                              day: "2-digit",
                              month: "long",
                            })}
                          </p>
                          <p className="text-xs text-gray-400">
                            {g.total_players ?? 0} jogadores
                          </p>
                        </div>
                        <p className="font-display text-lg text-green-600 dark:text-green-400">
                          {moeda(g.total_arrecadado ?? 0)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <BottomNav />
      </div>
    </ProtectedRoute>
  );
}

// ── Sub-componentes ────────────────────────────────
function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl p-10 text-center text-gray-400 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
      {msg}
    </div>
  );
}
function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}
function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
