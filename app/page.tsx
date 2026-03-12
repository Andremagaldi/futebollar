"use client";

import React, { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Modo = "inicial" | "entrar" | "cadastrar";

export default function Home() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("inicial");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // ── Google OAuth ──────────────────────────────────
  async function handleGoogle() {
    setLoading(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/jogo` },
    });
    if (error) {
      setErro(error.message);
      setLoading(false);
    }
  }

  // ── Login com email ───────────────────────────────
  async function handleLogin() {
    if (!email || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) {
      setErro("E-mail ou senha incorretos.");
      setLoading(false);
    } else {
      router.push("/jogo");
    }
  }

  // ── Cadastro com email ────────────────────────────
  async function handleCadastro() {
    if (!nome || !email || !senha) {
      setErro("Preencha todos os campos.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    setErro(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { data: { nome_completo: nome } },
    });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    // Inserir perfil na tabela users
    if (data.user) {
      await supabase.from("users").upsert({
        id: data.user.id,
        nome_completo: nome,
        email,
        tipo: "avulso",
        posicao: "linha",
        status: "pendente",
        role: "jogador",
      });
    }

    setSucesso(
      "Cadastro realizado! Verifique seu e-mail para confirmar a conta.",
    );
    setLoading(false);
  }

  function voltar() {
    setModo("inicial");
    setErro(null);
    setSucesso(null);
    setEmail("");
    setSenha("");
    setNome("");
  }

  // ── RENDER ────────────────────────────────────────
  return (
    <main className="flex min-h-dvh flex-col bg-white">
      {/* Imagem topo */}
      <div className="relative h-[45vh] w-full overflow-hidden sm:h-[60vh]">
        <Image
          src="/bolafutebol01.jpg"
          alt="Futebol"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 z-10 bg-black/10" />
        <div className="absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* Formulário */}
      <section className="relative z-30 -mt-12 flex w-full flex-1 flex-col items-center self-center px-6 pb-8 sm:max-w-[400px]">
        {/* Logo */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center justify-center rounded-full bg-[#004D98] p-2.5 shadow-lg">
            <span className="text-xs font-bold italic text-[#D4AF37]">FL</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            Futebol<span className="text-[#004D98]">Lar</span>
          </h1>
        </div>

        {/* Heading */}
        <h2 className="mb-6 text-center text-3xl font-black leading-[1.1] tracking-tight text-black">
          Aqui o seu futebol
          <br />é comunhão.
        </h2>

        {/* ── MODO INICIAL ── */}
        {modo === "inicial" && (
          <div className="w-full space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => setModo("entrar")}
                className="flex-1 rounded-xl bg-[#00D177] py-4 font-bold text-black shadow-md shadow-[#00D177]/20 transition-all duration-200 hover:bg-[#00b567] active:scale-95"
              >
                Entrar
              </button>
              <button
                onClick={() => setModo("cadastrar")}
                className="flex-1 rounded-xl bg-[#1A1A1A] py-4 font-bold text-white transition-all duration-200 hover:bg-black active:scale-95"
              >
                Sou novo por aqui
              </button>
            </div>

            <BotaoGoogle onClick={handleGoogle} loading={loading} />
          </div>
        )}

        {/* ── MODO ENTRAR ── */}
        {modo === "entrar" && (
          <div className="w-full space-y-3">
            <CampoTexto
              label="E-mail"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="seu@email.com"
            />
            <CampoTexto
              label="Senha"
              type="password"
              value={senha}
              onChange={setSenha}
              placeholder="••••••••"
              onEnter={handleLogin}
            />

            {erro && <MensagemErro texto={erro} />}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full rounded-xl bg-[#00D177] py-4 font-bold text-black shadow-md shadow-[#00D177]/20 transition-all duration-200 hover:bg-[#00b567] active:scale-95 disabled:opacity-60"
            >
              {loading ? <Spinner /> : "Entrar"}
            </button>

            <BotaoGoogle onClick={handleGoogle} loading={loading} />

            <button
              onClick={voltar}
              className="w-full pt-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Voltar
            </button>
          </div>
        )}

        {/* ── MODO CADASTRAR ── */}
        {modo === "cadastrar" && (
          <div className="w-full space-y-3">
            {sucesso ? (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-sm font-semibold text-green-700">
                  {sucesso}
                </p>
                <button
                  onClick={voltar}
                  className="mt-4 w-full rounded-xl bg-[#004D98] py-3 font-bold text-white transition-all active:scale-95"
                >
                  Fazer login
                </button>
              </div>
            ) : (
              <>
                <CampoTexto
                  label="Nome completo"
                  type="text"
                  value={nome}
                  onChange={setNome}
                  placeholder="Seu nome"
                />
                <CampoTexto
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="seu@email.com"
                />
                <CampoTexto
                  label="Senha"
                  type="password"
                  value={senha}
                  onChange={setSenha}
                  placeholder="Mínimo 6 caracteres"
                  onEnter={handleCadastro}
                />

                {erro && <MensagemErro texto={erro} />}

                <button
                  onClick={handleCadastro}
                  disabled={loading}
                  className="w-full rounded-xl bg-[#1A1A1A] py-4 font-bold text-white transition-all duration-200 hover:bg-black active:scale-95 disabled:opacity-60"
                >
                  {loading ? <Spinner dark /> : "Criar minha conta"}
                </button>

                <BotaoGoogle onClick={handleGoogle} loading={loading} />

                <button
                  onClick={voltar}
                  className="w-full pt-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ← Voltar
                </button>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        {modo === "inicial" && (
          <p className="mt-auto pt-10 text-center text-sm text-gray-400">
            Não tem uma conta?{" "}
            <button
              onClick={() => setModo("cadastrar")}
              className="font-bold text-[#004D98] hover:underline"
            >
              Cadastre-se.
            </button>
          </p>
        )}
      </section>
    </main>
  );
}

// ── Sub-componentes ────────────────────────────────

function BotaoGoogle({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-100 py-4 transition-all duration-200 hover:bg-gray-50 active:scale-95 disabled:opacity-60"
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
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      <span className="font-semibold text-gray-600">Entrar com Google</span>
    </button>
  );
}

function CampoTexto({
  label,
  type,
  value,
  onChange,
  placeholder,
  onEnter,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onEnter?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        className="w-full rounded-xl border-2 border-gray-100 px-4 py-3.5 text-sm text-gray-900 placeholder-gray-300 outline-none transition-all focus:border-[#004D98]"
      />
    </div>
  );
}

function MensagemErro({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
      <p className="text-sm text-red-600 font-medium">⚠️ {texto}</p>
    </div>
  );
}

function Spinner({ dark = false }: { dark?: boolean }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <span
        className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${
          dark ? "border-white" : "border-black"
        }`}
      />
      Aguarde...
    </span>
  );
}
