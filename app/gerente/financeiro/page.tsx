"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface Entrada {
  id: string;
  nome: string;
  valor_pago: number;
  tipo: string;
  data: string;
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

type Aba = "resumo" | "entradas" | "despesas" | "nova_despesa";

const CATEGORIAS = [
  { value: "equipamentos", label: "🏋️ Equipamentos" },
  { value: "jardinagem", label: "🌿 Jardinagem" },
  { value: "manutencao", label: "🔧 Manutenção" },
  { value: "alimentacao", label: "🍕 Alimentação" },
  { value: "outros", label: "📦 Outros" },
];

export default function GerenteFinanceiroPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aba, setAba] = useState<Aba>("resumo");
  const [resumo, setResumo] = useState<Resumo>({
    total_entradas: 0,
    total_saidas: 0,
    saldo: 0,
  });
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);

  // Nova despesa
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("outros");
  const [observacao, setObservacao] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  // Verificar autenticação do gerente
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("gerente_auth");
      if (!auth) {
        router.push("/gerente");
        return;
      }
    }
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([loadResumo(), loadEntradas(), loadDespesas()]);
    setLoading(false);
  }

  async function loadResumo() {
    const { data } = await supabase
      .from("vw_financeiro_geral")
      .select("*")
      .single();
    if (data) setResumo(data);
  }

  async function loadEntradas() {
    const { data } = await supabase
      .from("game_players")
      .select(
        "id, valor_pago, tipo, criado_em, users(nome_completo), games(data_jogo)",
      )
      .eq("payment_status", "pago")
      .not("valor_pago", "is", null)
      .order("criado_em", { ascending: false });

    if (data) {
      setEntradas(
        data.map((d) => ({
          id: d.id,
          nome: (d.users as any)?.nome_completo ?? "—",
          valor_pago: d.valor_pago,
          tipo: d.tipo,
          data: d.criado_em,
        })),
      );
    }
  }

  async function loadDespesas() {
    const { data } = await supabase
      .from("despesas")
      .select("*")
      .order("criado_em", { ascending: false });

    if (data) setDespesas(data);
  }

  // Upload e análise IA do comprovante de despesa
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
                  text: `Analise este comprovante de despesa/pagamento e extraia as informações.
Responda APENAS em JSON válido, sem markdown, sem backticks:
{
  "descricao": "descrição do que foi comprado/pago",
  "valor": número ou null (ex: 150.00),
  "categoria": "equipamentos" ou "jardinagem" ou "manutencao" ou "alimentacao" ou "outros",
  "observacao": "detalhes adicionais relevantes ou null"
}`,
                },
              ],
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? "";
      const clean = text.replace(/```json|```/g, "").trim();
      const result = JSON.parse(clean);

      if (result.descricao) setDescricao(result.descricao);
      if (result.valor) setValor(String(result.valor));
      if (result.categoria) setCategoria(result.categoria);
      if (result.observacao) setObservacao(result.observacao);
    } catch {
      // Se falhar, usuário preenche manualmente
    }
    setAnalisando(false);
  }

  async function salvarDespesa() {
    if (!descricao || !valor) return;
    setSalvando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let comprovante_url = null;

    // Upload do comprovante se tiver
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

    // Reset form
    setDescricao("");
    setValor("");
    setCategoria("outros");
    setObservacao("");
    setPreview(null);
    setSelectedFile(null);
    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
    await loadAll();
    setAba("despesas");
  }

  function sair() {
    sessionStorage.removeItem("gerente_auth");
    router.push("/gerente");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const saldoPositivo = resumo.saldo >= 0;

  return (
    <div className="min-h-screen bg-green-950 text-white px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-green-400 text-sm">Área do Gerente</p>
          </div>
          <button
            onClick={sair}
            className="text-red-400 text-sm hover:text-red-300 border border-red-800/50 px-3 py-1.5 rounded-lg"
          >
            Sair
          </button>
        </div>

        {/* Cards resumo */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-green-900/40 border border-green-700/40 rounded-2xl p-4 text-center">
            <p className="text-green-400 text-xs mb-1">Entradas</p>
            <p className="text-green-300 font-bold text-lg">
              R$ {resumo.total_entradas.toFixed(2)}
            </p>
          </div>
          <div className="bg-red-900/30 border border-red-800/40 rounded-2xl p-4 text-center">
            <p className="text-red-400 text-xs mb-1">Saídas</p>
            <p className="text-red-300 font-bold text-lg">
              R$ {resumo.total_saidas.toFixed(2)}
            </p>
          </div>
          <div
            className={`rounded-2xl p-4 text-center border ${
              saldoPositivo
                ? "bg-emerald-900/40 border-emerald-700/40"
                : "bg-orange-900/30 border-orange-800/40"
            }`}
          >
            <p
              className={`text-xs mb-1 ${saldoPositivo ? "text-emerald-400" : "text-orange-400"}`}
            >
              Saldo
            </p>
            <p
              className={`font-bold text-lg ${saldoPositivo ? "text-emerald-300" : "text-orange-300"}`}
            >
              R$ {resumo.saldo.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1 bg-green-900/30 rounded-xl p-1 mb-6 overflow-x-auto">
          {(
            [
              { key: "resumo", label: "📊 Resumo" },
              { key: "entradas", label: "💚 Entradas" },
              { key: "despesas", label: "🔴 Saídas" },
              { key: "nova_despesa", label: "+ Despesa" },
            ] as { key: Aba; label: string }[]
          ).map((a) => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className={`flex-1 whitespace-nowrap py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                aba === a.key
                  ? "bg-green-700 text-white"
                  : "text-green-500 hover:text-green-300"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* ABA: RESUMO */}
        {aba === "resumo" && (
          <div className="space-y-3">
            <div className="bg-green-900/30 border border-green-800/40 rounded-2xl p-5">
              <p className="text-green-400 text-sm mb-4 font-semibold">
                Últimas movimentações
              </p>
              {[
                ...entradas
                  .slice(0, 3)
                  .map((e) => ({
                    tipo: "entrada" as const,
                    nome: e.nome,
                    valor: e.valor_pago,
                    data: e.data,
                  })),
                ...despesas
                  .slice(0, 3)
                  .map((d) => ({
                    tipo: "saida" as const,
                    nome: d.descricao,
                    valor: d.valor,
                    data: d.criado_em,
                  })),
              ]
                .sort(
                  (a, b) =>
                    new Date(b.data).getTime() - new Date(a.data).getTime(),
                )
                .slice(0, 6)
                .map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 border-b border-green-900/50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span>{item.tipo === "entrada" ? "💚" : "🔴"}</span>
                      <div>
                        <p className="text-white text-sm">{item.nome}</p>
                        <p className="text-green-600 text-xs">
                          {formatData(item.data)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-semibold text-sm ${item.tipo === "entrada" ? "text-green-400" : "text-red-400"}`}
                    >
                      {item.tipo === "entrada" ? "+" : "-"}R${" "}
                      {item.valor.toFixed(2)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ABA: ENTRADAS */}
        {aba === "entradas" && (
          <div className="space-y-2">
            {entradas.length === 0 ? (
              <Empty msg="Nenhuma entrada registrada" />
            ) : (
              entradas.map((e) => (
                <div
                  key={e.id}
                  className="bg-green-900/40 border border-green-800/40 rounded-xl px-4 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{e.nome}</p>
                    <p className="text-green-500 text-xs">
                      {formatTipo(e.tipo)} · {formatData(e.data)}
                    </p>
                  </div>
                  <p className="text-green-400 font-bold">
                    +R$ {Number(e.valor_pago).toFixed(2)}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {/* ABA: DESPESAS */}
        {aba === "despesas" && (
          <div className="space-y-2">
            {despesas.length === 0 ? (
              <Empty msg="Nenhuma despesa registrada" />
            ) : (
              despesas.map((d) => (
                <div
                  key={d.id}
                  className="bg-green-900/40 border border-green-800/40 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs bg-green-800/60 text-green-400 px-2 py-0.5 rounded-full">
                          {CATEGORIAS.find((c) => c.value === d.categoria)
                            ?.label ?? d.categoria}
                        </span>
                      </div>
                      <p className="text-white text-sm font-medium truncate">
                        {d.descricao}
                      </p>
                      <p className="text-green-600 text-xs">
                        {formatData(d.criado_em)}
                      </p>
                      {d.observacao && (
                        <p className="text-green-500 text-xs mt-0.5 italic">
                          {d.observacao}
                        </p>
                      )}
                    </div>
                    <p className="text-red-400 font-bold flex-shrink-0">
                      -R$ {Number(d.valor).toFixed(2)}
                    </p>
                  </div>
                  {d.comprovante_url && (
                    <div className="border-t border-green-800/40 px-4 py-2">
                      <a
                        href={d.comprovante_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-500 text-xs hover:text-green-300 flex items-center gap-1"
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

        {/* ABA: NOVA DESPESA */}
        {aba === "nova_despesa" && (
          <div className="space-y-4">
            {/* Upload comprovante */}
            <div className="bg-green-900/40 border border-green-800/40 rounded-2xl p-4">
              <p className="text-green-400 text-sm mb-3">
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
                  className="w-full border-2 border-dashed border-green-700 rounded-xl py-8 flex flex-col items-center gap-2 text-green-400 hover:border-green-500 transition-colors"
                >
                  <span className="text-3xl">📎</span>
                  <span className="text-sm">Foto do comprovante</span>
                  <span className="text-xs text-green-600">
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
            <div className="bg-green-900/40 border border-green-800/40 rounded-2xl p-4 space-y-3">
              <p className="text-green-400 text-sm">Dados da despesa</p>

              <div>
                <label className="text-green-500 text-xs mb-1 block">
                  Descrição *
                </label>
                <input
                  type="text"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Compra de coletes novos"
                  className="w-full bg-green-950 border border-green-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-green-700 focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-green-500 text-xs mb-1 block">
                  Valor (R$) *
                </label>
                <input
                  type="number"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full bg-green-950 border border-green-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-green-700 focus:outline-none focus:border-green-500"
                />
              </div>

              <div>
                <label className="text-green-500 text-xs mb-1 block">
                  Categoria
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIAS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCategoria(c.value)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium transition-colors border text-left ${
                        categoria === c.value
                          ? "bg-green-700 border-green-600 text-white"
                          : "bg-green-950 border-green-800 text-green-400 hover:border-green-600"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-green-500 text-xs mb-1 block">
                  Observação
                </label>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Detalhes adicionais..."
                  rows={2}
                  className="w-full bg-green-950 border border-green-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder-green-700 focus:outline-none focus:border-green-500 resize-none"
                />
              </div>

              <button
                onClick={salvarDespesa}
                disabled={salvando || !descricao || !valor}
                className="w-full bg-red-700 hover:bg-red-600 disabled:bg-green-800 disabled:text-green-600 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {salvando ? (
                  <>
                    <Spinner /> Salvando...
                  </>
                ) : salvo ? (
                  "✓ Salvo!"
                ) : (
                  "Registrar despesa"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────

function Empty({ msg }: { msg: string }) {
  return (
    <div className="bg-green-900/20 rounded-2xl p-10 text-center text-green-600">
      {msg}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}

function formatData(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTipo(tipo: string) {
  const map: Record<string, string> = {
    mensalista: "Mensalista",
    avulso: "Avulso",
    mensalista_membro: "Mensalista",
    avulso_membro: "Avulso",
    mensalista_convidado: "Mensalista Convidado",
    avulso_convidado: "Avulso Convidado",
  };
  return map[tipo] ?? tipo;
}
