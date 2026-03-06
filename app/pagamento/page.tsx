"use client";

import { useEffect, useState, useRef } from "react";

import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

interface GamePlayer {
  id: string;
  game_id: string;
  user_id: string;
  status: string;
  tipo: string;
  payment_status: string;
  multa_aplicada: boolean;
  comprovante_url?: string;
  comprovante_status?: string;
  comprovante_observacao?: string;
  valor_pago?: number;
  games?: { data_jogo: string; valor_avulso?: number };
  users?: { nome: string };
}

type UploadStep = "idle" | "uploading" | "analyzing" | "done" | "error";

export default function PagamentoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<UploadStep>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{
    isPix: boolean;
    valor?: number;
    data?: string;
    destinatario?: string;
    confianca: "alta" | "media" | "baixa";
    observacao: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayerData();
  }, []);

  async function loadPlayerData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // Busca a inscrição mais recente do jogador (jogo ainda não realizado)
    const { data, error } = await supabase
      .from("game_players")
      .select(
        `*, 
        games(data_jogo, valor_avulso),
        users(nome)`,
      )
      .eq("user_id", user.id)
      .eq("status", "confirmado")
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      setError("Você não está inscrito em nenhuma partida.");
    } else {
      setPlayer(data);
    }
    setLoading(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setAnalysisResult(null);
    setError(null);
    setStep("idle");

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function analyzeComprovante(
    base64: string,
  ): Promise<typeof analysisResult> {
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
                  media_type: selectedFile?.type || "image/jpeg",
                  data: base64.split(",")[1],
                },
              },
              {
                type: "text",
                text: `Analise esta imagem e determine se é um comprovante de pagamento PIX válido.
                
Responda APENAS em JSON válido, sem nenhum texto adicional, sem markdown, sem backticks:
{
  "isPix": true ou false,
  "valor": número ou null (ex: 30.00),
  "data": "string da data encontrada ou null",
  "destinatario": "nome do destinatário ou null",
  "confianca": "alta" ou "media" ou "baixa",
  "observacao": "breve explicação em português"
}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    try {
      const clean = text.replace(/```json|```/g, "").trim();
      return JSON.parse(clean);
    } catch {
      return {
        isPix: false,
        confianca: "baixa",
        observacao: "Não foi possível analisar a imagem. Tente novamente.",
      };
    }
  }

  async function handleEnviarComprovante() {
    if (!selectedFile || !player || !preview) return;

    try {
      setStep("uploading");
      setError(null);

      // 1. Upload para o Supabase Storage
      const ext = selectedFile.name.split(".").pop();
      const fileName = `${player.game_id}/${player.user_id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("comprovantes")
        .upload(fileName, selectedFile, { upsert: true });

      if (uploadError)
        throw new Error("Erro no upload: " + uploadError.message);

      const { data: urlData } = supabase.storage
        .from("comprovantes")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 2. Analisar com IA
      setStep("analyzing");
      const result = await analyzeComprovante(preview);
      setAnalysisResult(result);

      // 3. Salvar no banco com status e URL
      const { error: dbError } = await supabase.rpc("registrar_comprovante", {
        p_game_player_id: player.id,
        p_comprovante_url: publicUrl,
      });

      if (dbError) throw new Error("Erro ao salvar: " + dbError.message);

      // 4. Se IA aprovou com confiança alta, aprovar automaticamente
      if (result?.isPix && result.confianca === "alta") {
        await supabase.rpc("aprovar_comprovante", {
          p_game_player_id: player.id,
          p_valor_pago: result.valor ?? null,
          p_observacao: `Aprovado automaticamente. ${result.observacao}`,
        });
        await loadPlayerData();
      }

      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("error");
    }
  }

  // --- RENDER ---

  if (loading) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const jaPago = player?.payment_status === "pago";
  const aguardando = player?.comprovante_status === "aguardando_analise";
  const rejeitado = player?.comprovante_status === "rejeitado";

  return (
    <div className="min-h-screen bg-green-950 text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-green-400 text-sm mb-4 flex items-center gap-1 hover:text-green-300"
          >
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold">Pagamento via PIX</h1>
          <p className="text-green-400 text-sm mt-1">
            Envie o comprovante e confirmamos automaticamente
          </p>
        </div>

        {!player ? (
          <div className="bg-green-900/40 rounded-2xl p-6 text-center">
            <p className="text-green-300">{error}</p>
          </div>
        ) : (
          <>
            {/* Status atual */}
            <div className="bg-green-900/40 rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-green-400 text-sm">
                  Status do pagamento
                </span>
                <StatusBadge
                  status={player.payment_status}
                  comprobanteStatus={player.comprovante_status}
                />
              </div>
              <p className="font-semibold text-lg">{player.users?.nome}</p>
              <p className="text-green-400 text-sm">
                Tipo: {formatTipo(player.tipo)}
              </p>
              {player.multa_aplicada && (
                <div className="mt-3 bg-red-900/40 rounded-xl px-4 py-2 text-red-300 text-sm">
                  ⚠️ Multa de 20% aplicada por atraso
                </div>
              )}
              {rejeitado && (
                <div className="mt-3 bg-red-900/40 rounded-xl px-4 py-2 text-red-300 text-sm">
                  ❌ Comprovante rejeitado: {player.comprovante_observacao}
                </div>
              )}
            </div>

            {/* Chave PIX */}
            {!jaPago && (
              <div className="bg-green-900/40 rounded-2xl p-5 mb-6">
                <p className="text-green-400 text-sm mb-3">
                  Chave PIX para pagamento
                </p>
                <ChavePix />
              </div>
            )}

            {/* Área de upload */}
            {!jaPago && !aguardando && (
              <div className="bg-green-900/40 rounded-2xl p-5 mb-6">
                <p className="text-green-400 text-sm mb-4">
                  Enviar comprovante
                </p>

                {/* Preview */}
                {preview ? (
                  <div className="relative mb-4">
                    <img
                      src={preview}
                      alt="Comprovante"
                      className="w-full rounded-xl object-cover max-h-64"
                    />
                    <button
                      onClick={() => {
                        setPreview(null);
                        setSelectedFile(null);
                        setAnalysisResult(null);
                        setStep("idle");
                      }}
                      className="absolute top-2 right-2 bg-black/60 rounded-full w-7 h-7 flex items-center justify-center text-white text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-green-700 rounded-xl py-10 flex flex-col items-center gap-2 text-green-400 hover:border-green-500 hover:text-green-300 transition-colors"
                  >
                    <span className="text-3xl">📎</span>
                    <span className="text-sm">
                      Toque para selecionar a foto
                    </span>
                    <span className="text-xs text-green-600">
                      JPG, PNG, PDF — máx. 5MB
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

                {/* Resultado da análise */}
                {analysisResult && step === "done" && (
                  <AnalysisCard result={analysisResult} />
                )}

                {/* Botão de envio */}
                {selectedFile && step !== "done" && (
                  <button
                    onClick={handleEnviarComprovante}
                    disabled={step === "uploading" || step === "analyzing"}
                    className="w-full mt-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-green-600 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {step === "uploading" && (
                      <>
                        <Spinner /> Enviando...
                      </>
                    )}
                    {step === "analyzing" && (
                      <>
                        <Spinner /> Analisando com IA...
                      </>
                    )}
                    {(step === "idle" || step === "error") &&
                      "Enviar Comprovante"}
                  </button>
                )}

                {error && step === "error" && (
                  <p className="text-red-400 text-sm mt-3 text-center">
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* Aguardando análise manual */}
            {aguardando && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-2xl p-5 text-center">
                <p className="text-2xl mb-2">⏳</p>
                <p className="font-semibold text-yellow-300">
                  Comprovante em análise
                </p>
                <p className="text-yellow-400/70 text-sm mt-1">
                  O admin irá confirmar em breve
                </p>
              </div>
            )}

            {/* Pago */}
            {jaPago && (
              <div className="bg-green-800/40 border border-green-600/50 rounded-2xl p-6 text-center">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-bold text-xl text-green-300">
                  Pagamento confirmado!
                </p>
                {player.valor_pago && (
                  <p className="text-green-400 mt-1">
                    Valor: R$ {Number(player.valor_pago).toFixed(2)}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────

function ChavePix() {
  const [copiado, setCopiado] = useState(false);
  // Troque pela sua chave PIX real
  const CHAVE_PIX = "futebollarcristo@email.com";

  function copiar() {
    navigator.clipboard.writeText(CHAVE_PIX);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex items-center gap-3 bg-green-950/60 rounded-xl px-4 py-3">
      <div className="flex-1">
        <p className="text-xs text-green-500 mb-0.5">E-mail / chave</p>
        <p className="font-mono text-sm text-white">{CHAVE_PIX}</p>
      </div>
      <button
        onClick={copiar}
        className="bg-green-700 hover:bg-green-600 px-3 py-1.5 rounded-lg text-sm transition-colors"
      >
        {copiado ? "✓ Copiado" : "Copiar"}
      </button>
    </div>
  );
}

function StatusBadge({
  status,
  comprobanteStatus,
}: {
  status: string;
  comprobanteStatus?: string;
}) {
  if (status === "pago")
    return (
      <span className="bg-green-700/60 text-green-300 text-xs px-3 py-1 rounded-full font-medium">
        ✓ Pago
      </span>
    );
  if (comprobanteStatus === "aguardando_analise")
    return (
      <span className="bg-yellow-700/60 text-yellow-300 text-xs px-3 py-1 rounded-full font-medium">
        ⏳ Em análise
      </span>
    );
  if (comprobanteStatus === "rejeitado")
    return (
      <span className="bg-red-700/60 text-red-300 text-xs px-3 py-1 rounded-full font-medium">
        ✕ Rejeitado
      </span>
    );
  return (
    <span className="bg-orange-700/60 text-orange-300 text-xs px-3 py-1 rounded-full font-medium">
      Pendente
    </span>
  );
}

function AnalysisCard({
  result,
}: {
  result: NonNullable<
    ReturnType<
      () => {
        isPix: boolean;
        valor?: number;
        data?: string;
        destinatario?: string;
        confianca: "alta" | "media" | "baixa";
        observacao: string;
      }
    >
  >;
}) {
  const colors = {
    alta: "border-green-600/50 bg-green-900/30 text-green-300",
    media: "border-yellow-600/50 bg-yellow-900/30 text-yellow-300",
    baixa: "border-red-600/50 bg-red-900/30 text-red-300",
  };

  return (
    <div className={`mt-4 border rounded-xl p-4 ${colors[result.confianca]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{result.isPix ? "✅" : "❌"}</span>
        <span className="font-semibold text-sm">
          {result.isPix
            ? "Comprovante PIX detectado"
            : "Não parece um comprovante PIX"}
        </span>
        <span className="ml-auto text-xs opacity-70">
          Confiança: {result.confianca}
        </span>
      </div>
      {result.valor && (
        <p className="text-sm">💰 Valor: R$ {result.valor.toFixed(2)}</p>
      )}
      {result.data && <p className="text-sm">📅 Data: {result.data}</p>}
      {result.destinatario && (
        <p className="text-sm">👤 Destinatário: {result.destinatario}</p>
      )}
      <p className="text-xs mt-2 opacity-80">{result.observacao}</p>
      {result.confianca !== "alta" && result.isPix && (
        <p className="text-xs mt-2 opacity-60">
          O admin irá confirmar manualmente.
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
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
