"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Step = "validando" | "invalido" | "auth" | "perfil" | "aguardando";

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<Step>("validando");
  const [motivoInvalido, setMotivoInvalido] = useState("");
  const [conviteId, setConviteId] = useState<string | null>(null);

  // Auth
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modoAuth, setModoAuth] = useState<"signup" | "login">("signup");
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [erroAuth, setErroAuth] = useState<string | null>(null);

  // Perfil
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [telefone, setTelefone] = useState("");
  const [posicao, setPosicao] = useState("linha");
  const [categoria, setCategoria] = useState("membro");
  const [tipo, setTipo] = useState("avulso");
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [erroPerfil, setErroPerfil] = useState<string | null>(null);

  useEffect(() => {
    validarToken();
  }, [token]);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          const { data: user } = await supabase
            .from("users")
            .select("nome_completo")
            .eq("id", session.user.id)
            .single();

          if (user?.nome_completo) {
            setStep("aguardando");
          } else {
            const nome = session.user.user_metadata?.full_name ?? "";
            setNomeCompleto(nome);
            setStep("perfil");
          }
        }
      },
    );
    return () => listener.subscription.unsubscribe();
  }, []);

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

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data: userDb } = await supabase
        .from("users")
        .select("nome_completo")
        .eq("id", session.user.id)
        .single();
      if (userDb?.nome_completo) {
        setStep("aguardando");
      } else {
        setNomeCompleto(session.user.user_metadata?.full_name ?? "");
        setStep("perfil");
      }
    } else {
      setStep("auth");
    }
  }

  async function loginGoogle() {
    setLoadingAuth(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/convite/${token}` },
    });
  }

  async function loginEmail() {
    if (!email || !senha) {
      setErroAuth("Preencha email e senha.");
      return;
    }
    setLoadingAuth(true);
    setErroAuth(null);

    if (modoAuth === "signup") {
      const { error } = await supabase.auth.signUp({ email, password: senha });
      if (error) {
        setErroAuth(traduzirErro(error.message));
        setLoadingAuth(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });
      if (error) {
        setErroAuth(traduzirErro(error.message));
        setLoadingAuth(false);
        return;
      }
    }
    setLoadingAuth(false);
  }

  async function salvarPerfil() {
    if (!nomeCompleto.trim() || !telefone.trim()) {
      setErroPerfil("Nome completo e celular são obrigatórios.");
      return;
    }
    setSalvandoPerfil(true);
    setErroPerfil(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setErroPerfil("Sessão expirada. Recarregue a página.");
      return;
    }

    const { error } = await supabase.from("users").upsert({
      id: session.user.id,
      nome_completo: nomeCompleto.trim(),
      telefone: telefone.trim(),
      posicao,
      categoria,
      tipo,
      tipo_pagamento: tipo,
      status: "pendente",
      role: "jogador",
      stars: 0,
      mvp_count: 0,
      is_admin: false,
      is_mensalista: tipo === "mensalista",
    });

    if (error) {
      setErroPerfil("Erro ao salvar perfil. Tente novamente.");
      setSalvandoPerfil(false);
      return;
    }

    if (conviteId) {
      await supabase.from("pedidos_entrada").insert({
        convite_id: conviteId,
        nome_completo: nomeCompleto.trim(),
        telefone: telefone.trim(),
        email: session.user.email,
        posicao,
        categoria,
        tipo,
        user_id: session.user.id,
      });
    }

    await fetch("/api/notificar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: "⚽ Novo pedido de entrada!",
        mensagem: `${nomeCompleto.split(" ")[0]} quer entrar no grupo. Toque para revisar.`,
        url: `${window.location.origin}/admin/convites`,
      }),
    });

    setSalvandoPerfil(false);
    setStep("aguardando");
  }

  // ── RENDERS ──────────────────────────────────────

  if (step === "validando") {
    return (
      <div className="min-h-screen bg-[#080c20] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (step === "invalido") {
    return (
      <div className="min-h-screen bg-[#080c20] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-5xl mb-4">🔒</p>
          <h1 className="text-xl font-bold text-white mb-2">Link inválido</h1>
          <p className="text-blue-300 text-sm">{motivoInvalido}</p>
          <p className="text-blue-500 text-xs mt-4">
            Peça um novo link ao administrador.
          </p>
        </div>
      </div>
    );
  }

  if (step === "aguardando") {
    return (
      <div className="min-h-screen bg-[#080c20] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-6xl mb-4">🎉</p>
          <h1 className="text-2xl font-bold text-white mb-2">
            Pedido enviado!
          </h1>
          <p className="text-blue-200 text-sm leading-relaxed">
            Seu cadastro foi registrado. O administrador irá analisar e
            confirmar sua entrada no grupo em breve.
          </p>
          <p className="text-yellow-400 text-xs mt-4">
            Fique de olho no seu WhatsApp! ⚽
          </p>
        </div>
      </div>
    );
  }

  if (step === "auth") {
    return (
      <div className="min-h-screen bg-[#080c20] text-white px-4 py-10 flex items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center text-3xl"
              style={{
                background:
                  "linear-gradient(135deg, #c0143c, #e8b923, #1a4fc4)",
              }}
            >
              ⚽
            </div>
            <h1 className="text-2xl font-bold">Futebol Lar Cristão</h1>
            <p className="text-blue-300 text-sm mt-1">
              Crie sua conta para entrar no grupo
            </p>
          </div>

          {/* Google */}
          <button
            onClick={loginGoogle}
            disabled={loadingAuth}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 font-semibold py-3.5 rounded-xl mb-4 hover:bg-gray-100 transition-colors disabled:opacity-60 shadow-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Entrar com Google
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs">ou</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu e-mail"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-500/50"
            />
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loginEmail()}
              placeholder="Senha (mín. 6 caracteres)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-500/50"
            />

            {erroAuth && <p className="text-red-400 text-xs">{erroAuth}</p>}

            <button
              onClick={loginEmail}
              disabled={loadingAuth}
              className="w-full py-3.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 text-white"
              style={{
                background: "linear-gradient(135deg, #c0143c, #8b0020)",
              }}
            >
              {loadingAuth
                ? "Aguarde..."
                : modoAuth === "signup"
                  ? "Criar conta"
                  : "Entrar"}
            </button>

            <button
              onClick={() => {
                setModoAuth(modoAuth === "signup" ? "login" : "signup");
                setErroAuth(null);
              }}
              className="w-full text-center text-white/40 text-xs hover:text-white/60 py-1"
            >
              {modoAuth === "signup"
                ? "Já tenho conta → Entrar"
                : "Não tenho conta → Criar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "perfil") {
    return (
      <div className="min-h-screen bg-[#080c20] text-white px-4 py-10">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <p className="text-3xl mb-2">👤</p>
            <h1 className="text-xl font-bold">Complete seu perfil</h1>
            <p className="text-blue-300 text-sm mt-1">
              Quase lá! Preencha seus dados.
            </p>
          </div>

          <div
            className="space-y-4 rounded-2xl p-5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div>
              <label className="text-white/40 text-xs mb-1.5 block">
                Nome completo *
              </label>
              <input
                type="text"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                placeholder="Seu nome completo"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-500/50"
              />
            </div>

            <div>
              <label className="text-white/40 text-xs mb-1.5 block">
                WhatsApp *
              </label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 focus:outline-none focus:border-yellow-500/50"
              />
            </div>

            <div>
              <label className="text-white/40 text-xs mb-1.5 block">
                Posição
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "linha", l: "⚽ Linha" },
                  { v: "goleiro", l: "🧤 Goleiro" },
                ].map((p) => (
                  <ToggleBtn
                    key={p.v}
                    active={posicao === p.v}
                    onClick={() => setPosicao(p.v)}
                    label={p.l}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-white/40 text-xs mb-1.5 block">
                Categoria
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "membro", l: "👤 Membro" },
                  { v: "convidado", l: "🎟️ Convidado" },
                ].map((c) => (
                  <ToggleBtn
                    key={c.v}
                    active={categoria === c.v}
                    onClick={() => setCategoria(c.v)}
                    label={c.l}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-white/40 text-xs mb-1.5 block">
                Tipo de pagamento
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "avulso", l: "💳 Avulso" },
                  { v: "mensalista", l: "📅 Mensalista" },
                ].map((t) => (
                  <ToggleBtn
                    key={t.v}
                    active={tipo === t.v}
                    onClick={() => setTipo(t.v)}
                    label={t.l}
                  />
                ))}
              </div>
            </div>

            {erroPerfil && <p className="text-red-400 text-sm">{erroPerfil}</p>}

            <button
              onClick={salvarPerfil}
              disabled={salvandoPerfil}
              className="w-full py-4 rounded-xl font-bold text-base disabled:opacity-50 text-white"
              style={{
                background: "linear-gradient(135deg, #e8b923, #c9920a)",
              }}
            >
              {salvandoPerfil ? "Salvando..." : "Enviar pedido de entrada ⚽"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ToggleBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="py-2.5 rounded-xl text-sm font-medium border transition-colors"
      style={
        active
          ? {
              background: "linear-gradient(135deg, #c0143c33, #1a4fc433)",
              borderColor: "#e8b923aa",
              color: "white",
            }
          : {
              background: "rgba(255,255,255,0.03)",
              borderColor: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }
      }
    >
      {label}
    </button>
  );
}

function traduzirErro(msg: string): string {
  if (msg.includes("already registered"))
    return "Este email já está cadastrado. Tente entrar.";
  if (msg.includes("Invalid login")) return "Email ou senha incorretos.";
  if (msg.includes("Password should"))
    return "Senha deve ter pelo menos 6 caracteres.";
  return "Erro ao autenticar. Tente novamente.";
}
