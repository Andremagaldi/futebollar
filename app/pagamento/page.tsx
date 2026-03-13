"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import BottomNav from "@/components/layout/BottomNav";
import ThemeToggle from "@/components/ui/ThemeToggle";

// ── Troque pela sua chave PIX real ──
const CHAVE_PIX = "PixArenaLar@gmail.com";

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
  games?: { data_jogo: string };
  users?: { nome_completo: string };
}

type UploadStep = "idle" | "uploading" | "analyzing" | "done" | "error";

type AnalysisResult = {
  isPix: boolean;
  valor?: number;
  data?: string;
  destinatario?: string;
  confianca: "alta" | "media" | "baixa";
  observacao: string;
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

export default function PagamentoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [player, setPlayer] = useState<GamePlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<UploadStep>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    loadPlayerData();
  }, []);

  async function loadPlayerData() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/");
      return;
    }

    const { data, error: err } = await supabase
      .from("game_players")
      .select("*, games(data_jogo), users(nome_completo)")
      .eq("user_id", user.id)
      .eq("status", "confirmado")
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (err || !data) setError("Você não está inscrito em nenhuma partida.");
    else setPlayer(data);
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

  async function analyzeComprovante(base64: string): Promise<AnalysisResult> {
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
                text: `Analise esta imagem e determine se é um comprovante de pagamento PIX válido.\nResponda APENAS em JSON válido, sem texto adicional, sem markdown:\n{"isPix":true ou false,"valor":número ou null,"data":"string ou null","destinatario":"string ou null","confianca":"alta" ou "media" ou "baixa","observacao":"breve explicação em português"}`,
              },
            ],
          },
        ],
      }),
    });
    const data = await response.json();
    try {
      const clean = (data.content?.[0]?.text || "")
        .replace(/```json|```/g, "")
        .trim();
      return JSON.parse(clean);
    } catch {
      return {
        isPix: false,
        confianca: "baixa",
        observacao: "Não foi possível analisar. Tente novamente.",
      };
    }
  }

  async function handleEnviarComprovante() {
    if (!selectedFile || !player || !preview) return;
    try {
      setStep("uploading");
      setError(null);

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

      setStep("analyzing");
      const result = await analyzeComprovante(preview);
      setAnalysisResult(result);

      const { error: dbError } = await supabase.rpc("registrar_comprovante", {
        p_game_player_id: player.id,
        p_comprovante_url: urlData.publicUrl,
      });
      if (dbError) throw new Error("Erro ao salvar: " + dbError.message);

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

  function copiarPix() {
    navigator.clipboard.writeText(CHAVE_PIX).catch(() => {
      const el = document.createElement("textarea");
      el.value = CHAVE_PIX;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const jaPago = player?.payment_status === "pago";
  const aguardando = player?.comprovante_status === "aguardando_analise";
  const rejeitado = player?.comprovante_status === "rejeitado";

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
                Pagamento
              </p>
              <h1 className="font-display text-2xl leading-none text-gray-900 dark:text-white">
                PIX
              </h1>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <div className="px-4 py-4 space-y-4 max-w-md mx-auto">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
                />
              ))}
            </div>
          ) : !player ? (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="text-5xl mb-4">📋</p>
              <p className="font-display text-xl text-gray-900 dark:text-white">
                SEM INSCRIÇÃO ATIVA
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {error ?? "Você não está inscrito em nenhuma partida."}
              </p>
            </div>
          ) : (
            <>
              {/* ── Card status ── */}
              <div
                className={`rounded-2xl p-5 border ${
                  jaPago
                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40"
                    : aguardando
                      ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/40"
                      : rejeitado
                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40"
                        : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-base text-gray-900 dark:text-white">
                      {player.users?.nome_completo ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatTipo(player.tipo)}
                    </p>
                  </div>
                  {/* Badge */}
                  <span
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-bold ${
                      jaPago
                        ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                        : aguardando
                          ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
                          : rejeitado
                            ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                            : "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                    }`}
                  >
                    {jaPago
                      ? "✅ Pago"
                      : aguardando
                        ? "⏳ Em análise"
                        : rejeitado
                          ? "✕ Rejeitado"
                          : "⏰ Pendente"}
                  </span>
                </div>

                {player.multa_aplicada && (
                  <div className="mt-3 px-3 py-2 rounded-xl bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30">
                    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                      ⚠️ Multa de 20% aplicada por atraso
                    </p>
                  </div>
                )}

                {rejeitado && player.comprovante_observacao && (
                  <div className="mt-3 px-3 py-2 rounded-xl bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                    <p className="text-xs text-red-600 dark:text-red-400">
                      ❌ {player.comprovante_observacao}
                    </p>
                  </div>
                )}

                {jaPago && player.valor_pago && (
                  <p className="mt-3 text-sm font-semibold text-green-600 dark:text-green-400">
                    Valor pago: R$ {Number(player.valor_pago).toFixed(2)}
                  </p>
                )}
              </div>

              {/* ── Pago: sucesso ── */}
              {jaPago && (
                <div className="flex flex-col items-center py-10 text-center">
                  <p className="text-6xl mb-4">✅</p>
                  <p className="font-display text-2xl text-green-600 dark:text-green-400">
                    PAGAMENTO CONFIRMADO!
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Tudo certo para o jogo!
                  </p>
                </div>
              )}

              {/* ── Aguardando análise ── */}
              {aguardando && !jaPago && (
                <div className="flex flex-col items-center py-10 text-center rounded-2xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30">
                  <p className="text-5xl mb-3">⏳</p>
                  <p className="font-display text-xl text-yellow-700 dark:text-yellow-400">
                    COMPROVANTE EM ANÁLISE
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-2">
                    O admin irá confirmar em breve
                  </p>
                </div>
              )}

              {/* ── Chave PIX ── */}
              {!jaPago && !aguardando && (
                <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Chave PIX
                  </p>
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 mb-0.5">E-mail</p>
                      <p className="font-mono text-sm text-gray-900 dark:text-white truncate">
                        {CHAVE_PIX}
                      </p>
                    </div>
                    <button
                      onClick={copiarPix}
                      className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        copiado
                          ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                          : "bg-blue-600 text-white"
                      }`}
                    >
                      {copiado ? "✓ Copiado" : "Copiar"}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Upload comprovante ── */}
              {!jaPago && !aguardando && (
                <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-4 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Enviar comprovante
                  </p>

                  {preview ? (
                    <div className="relative">
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
                        className="absolute top-2 right-2 bg-black/60 rounded-full w-7 h-7 flex items-center justify-center text-white text-sm active:scale-95"
                      >
                        ✕
                      </button>
                      {/* Overlay analisando */}
                      {step === "analyzing" && (
                        <div className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center gap-2">
                          <Spinner />
                          <p className="text-white text-sm font-semibold">
                            IA analisando...
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-10 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-300 dark:hover:border-blue-700 transition-colors active:scale-[0.98]"
                    >
                      <span className="text-3xl">📎</span>
                      <span className="text-sm">
                        Toque para selecionar a foto
                      </span>
                      <span className="text-xs text-gray-300 dark:text-gray-600">
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
                    <div
                      className={`rounded-xl p-4 border ${
                        analysisResult.confianca === "alta"
                          ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-400"
                          : analysisResult.confianca === "media"
                            ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/30 text-yellow-700 dark:text-yellow-400"
                            : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span>{analysisResult.isPix ? "✅" : "❌"}</span>
                        <span className="font-semibold text-sm">
                          {analysisResult.isPix
                            ? "Comprovante PIX detectado"
                            : "Não parece um comprovante PIX"}
                        </span>
                        <span className="ml-auto text-xs opacity-70">
                          Confiança: {analysisResult.confianca}
                        </span>
                      </div>
                      {analysisResult.valor && (
                        <p className="text-sm">
                          💰 Valor: R$ {analysisResult.valor.toFixed(2)}
                        </p>
                      )}
                      {analysisResult.data && (
                        <p className="text-sm">
                          📅 Data: {analysisResult.data}
                        </p>
                      )}
                      {analysisResult.destinatario && (
                        <p className="text-sm">
                          👤 Destinatário: {analysisResult.destinatario}
                        </p>
                      )}
                      <p className="text-xs mt-2 opacity-80">
                        {analysisResult.observacao}
                      </p>
                      {analysisResult.confianca !== "alta" &&
                        analysisResult.isPix && (
                          <p className="text-xs mt-1 opacity-60">
                            O admin irá confirmar manualmente.
                          </p>
                        )}
                    </div>
                  )}

                  {/* Botão enviar */}
                  {selectedFile && step !== "done" && (
                    <button
                      onClick={handleEnviarComprovante}
                      disabled={step === "uploading" || step === "analyzing"}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {step === "uploading" ? (
                        <>
                          <Spinner /> Enviando...
                        </>
                      ) : step === "analyzing" ? (
                        <>
                          <Spinner /> Analisando com IA...
                        </>
                      ) : (
                        "Enviar Comprovante"
                      )}
                    </button>
                  )}

                  {error && step === "error" && (
                    <p className="text-red-500 text-sm text-center">{error}</p>
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

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
  );
}
