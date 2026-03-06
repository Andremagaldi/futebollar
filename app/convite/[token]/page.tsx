"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Step = "validando" | "invalido" | "formulario" | "enviado";

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("validando");
  const [motivoInvalido, setMotivoInvalido] = useState("");
  const [conviteId, setConviteId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Formulário
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [posicao, setPosicao] = useState("linha");
  const [categoria, setCategoria] = useState("membro");
  const [tipo, setTipo] = useState("avulso");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    validarToken();
  }, [token]);

  async function validarToken() {
    const { data, error } = await supabase.rpc("validar_convite", {
      p_token: token,
    });

    if (error || !data || data.length === 0) {
      setMotivoInvalido("Link inválido ou não encontrado.");
      setStep("invalido");
      return;
    }

    const resultado = data[0];
    if (!resultado.valido) {
      setMotivoInvalido(resultado.motivo);
      setStep("invalido");
      return;
    }

    setConviteId(resultado.id);
    setStep("formulario");
  }

  async function enviarPedido() {
    if (!nomeCompleto.trim() || !telefone.trim()) {
      setErro("Nome completo e celular são obrigatórios.");
      return;
    }

    setEnviando(true);
    setErro(null);

    // 1. Salva o pedido
    const { error } = await supabase.from("pedidos_entrada").insert({
      convite_id: conviteId,
      nome_completo: nomeCompleto.trim(),
      telefone: telefone.trim(),
      email: email.trim() || null,
      posicao,
      categoria,
      tipo,
    });

    if (error) {
      setErro("Erro ao enviar pedido. Tente novamente.");
      setEnviando(false);
      return;
    }

    // 2. Dispara notificação push para o admin
    await fetch("/api/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "⚽ Novo pedido de entrada!",
        mensagem: `${nomeCompleto.split(" ")[0]} quer entrar no grupo. Toque para revisar.`,
        url: `${window.location.origin}/admin/convites`,
      }),
    });

    setStep("enviado");
    setEnviando(false);
  }

  // ── RENDER ────────────────────────────────────────

  if (step === "validando") {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === "invalido") {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🔒</p>
          <h1 className="text-xl font-bold text-white mb-2">Link inválido</h1>
          <p className="text-green-400 text-sm">{motivoInvalido}</p>
          <p className="text-green-600 text-xs mt-4">
            Peça um novo link ao administrador do grupo.
          </p>
        </div>
      </div>
    );
  }

  if (step === "enviado") {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-6xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-white mb-2">
            Pedido enviado!
          </h1>
          <p className="text-green-400 text-sm leading-relaxed">
            Seu pedido foi registrado com sucesso. O administrador irá analisar
            e confirmar sua entrada no grupo em breve.
          </p>
          <p className="text-green-600 text-xs mt-4">
            Fique de olho no seu WhatsApp!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-950 text-white px-4 py-10">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            ⚽
          </div>
          <h1 className="text-2xl font-bold">Futebol Lar Cristão</h1>
          <p className="text-green-400 text-sm mt-1">
            Preencha seus dados para entrar no grupo
          </p>
        </div>

        {/* Formulário */}
        <div className="bg-green-900/40 border border-green-800/40 rounded-2xl p-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="text-green-400 text-xs mb-1.5 block">
              Nome completo *
            </label>
            <input
              type="text"
              value={nomeCompleto}
              onChange={(e) => setNomeCompleto(e.target.value)}
              placeholder="Seu nome completo"
              className="w-full bg-green-950 border border-green-700 rounded-xl px-4 py-3 text-white text-sm placeholder-green-700 focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Celular */}
          <div>
            <label className="text-green-400 text-xs mb-1.5 block">
              WhatsApp / Celular *
            </label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full bg-green-950 border border-green-700 rounded-xl px-4 py-3 text-white text-sm placeholder-green-700 focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-green-400 text-xs mb-1.5 block">
              E-mail (opcional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-green-950 border border-green-700 rounded-xl px-4 py-3 text-white text-sm placeholder-green-700 focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Posição */}
          <div>
            <label className="text-green-400 text-xs mb-1.5 block">
              Posição
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "linha", l: "⚽ Jogador de Linha" },
                { v: "goleiro", l: "🧤 Goleiro" },
              ].map((p) => (
                <button
                  key={p.v}
                  onClick={() => setPosicao(p.v)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    posicao === p.v
                      ? "bg-green-700 border-green-600 text-white"
                      : "bg-green-950 border-green-800 text-green-400"
                  }`}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </div>

          {/* Categoria */}
          <div>
            <label className="text-green-400 text-xs mb-1.5 block">
              Categoria
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "membro", l: "👤 Membro" },
                { v: "convidado", l: "🎟️ Convidado" },
              ].map((c) => (
                <button
                  key={c.v}
                  onClick={() => setCategoria(c.v)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    categoria === c.v
                      ? "bg-green-700 border-green-600 text-white"
                      : "bg-green-950 border-green-800 text-green-400"
                  }`}
                >
                  {c.l}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="text-green-400 text-xs mb-1.5 block">
              Tipo de pagamento
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "avulso", l: "💳 Avulso" },
                { v: "mensalista", l: "📅 Mensalista" },
              ].map((t) => (
                <button
                  key={t.v}
                  onClick={() => setTipo(t.v)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    tipo === t.v
                      ? "bg-green-700 border-green-600 text-white"
                      : "bg-green-950 border-green-800 text-green-400"
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          {erro && <p className="text-red-400 text-sm">{erro}</p>}

          <button
            onClick={enviarPedido}
            disabled={enviando}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-green-600 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-base"
          >
            {enviando ? (
              <>
                <Spinner /> Enviando...
              </>
            ) : (
              "Solicitar entrada no grupo"
            )}
          </button>
        </div>

        <p className="text-center text-green-700 text-xs mt-4">
          Seu pedido será analisado pelo administrador antes de ser aprovado.
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}
