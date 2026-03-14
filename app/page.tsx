"use client";

import React, { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [expandido, setExpandido] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    setErro(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErro(error.message);
      setLoading(false);
    }
  }

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

        <h2 className="mb-6 text-center text-3xl font-black leading-[1.1] tracking-tight text-black">
          Aqui o seu futebol
          <br />é comunhão.
        </h2>

        <div className="w-full space-y-3">
          {/* Form email/senha */}
          {!expandido ? (
            <button
              onClick={() => setExpandido(true)}
              className="w-full rounded-xl bg-[#00D177] py-4 font-bold text-black shadow-md shadow-[#00D177]/20 transition-all hover:bg-[#00b567] active:scale-95"
            >
              Entrar
            </button>
          ) : (
            <div className="space-y-3">
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
                className="w-full rounded-xl bg-[#00D177] py-4 font-bold text-black shadow-md shadow-[#00D177]/20 transition-all hover:bg-[#00b567] active:scale-95 disabled:opacity-60"
              >
                {loading ? <Spinner /> : "Entrar"}
              </button>
              <button
                onClick={() => {
                  setExpandido(false);
                  setErro(null);
                }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Voltar
              </button>
            </div>
          )}
          {/* Botão Google */}
          <BotaoGoogle onClick={handleGoogle} loading={loading} />
        </div>

        {/* Rodapé — convite */}
        <p className="mt-auto pt-10 text-center text-sm text-gray-400">
          Para se cadastrar, solicite um{" "}
          <span className="font-bold text-[#004D98]">
            convite ao administrador
          </span>
          .
        </p>
      </section>
    </main>
  );
}

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
      className="flex w-full items-center justify-center gap-3 rounded-xl border-2 border-gray-100 py-4 transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-60"
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

function Spinner() {
  return (
    <span className="flex items-center justify-center gap-2">
      <span className="w-4 h-4 border-2 border-t-transparent border-black rounded-full animate-spin" />
      Aguarde...
    </span>
  );
}
