"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GerenteLoginPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(false);
  const [loading, setLoading] = useState(false);

  function entrar() {
    setLoading(true);
    setErro(false);

    setTimeout(() => {
      if (senha === process.env.NEXT_PUBLIC_GERENTE_PASSWORD) {
        // Salva sessão do gerente no sessionStorage
        sessionStorage.setItem("gerente_auth", "true");
        router.push("/gerente/financeiro");
      } else {
        setErro(true);
      }
      setLoading(false);
    }, 600);
  }

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            💼
          </div>
          <h1 className="text-2xl font-bold text-white">Área do Gerente</h1>
          <p className="text-green-500 text-sm mt-1">Controle financeiro</p>
        </div>

        {/* Form */}
        <div className="bg-green-900/40 border border-green-800/40 rounded-2xl p-6 space-y-4">
          <div>
            <label className="text-green-400 text-sm mb-2 block">
              Senha de acesso
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => {
                setSenha(e.target.value);
                setErro(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && entrar()}
              placeholder="••••••••"
              className={`w-full bg-green-950 border rounded-xl px-4 py-3 text-white text-sm placeholder-green-700 focus:outline-none transition-colors ${
                erro
                  ? "border-red-500"
                  : "border-green-700 focus:border-green-500"
              }`}
            />
            {erro && (
              <p className="text-red-400 text-xs mt-1.5">
                Senha incorreta. Tente novamente.
              </p>
            )}
          </div>

          <button
            onClick={entrar}
            disabled={loading || !senha}
            className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:text-green-600 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Spinner /> : "Entrar"}
          </button>
        </div>

        <button
          onClick={() => router.back()}
          className="w-full text-center text-green-600 text-sm mt-4 hover:text-green-400"
        >
          ← Voltar
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}
