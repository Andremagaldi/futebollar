"use client";

import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";
import Image from "next/image";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Login realizado! Bem-vindo ao FutebolLar.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F172A] px-4 py-12 sm:px-6 lg:px-8 font-[family-name:var(--font-outfit)]">
      <div className="max-w-md w-full space-y-8 bg-[#1E293B] p-8 rounded-2xl border border-[#334155] shadow-2xl">
        {/* Header com Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            {/* Substitua pelo caminho da sua imagem de logo */}
            <div className="w-20 h-20 bg-gradient-to-tr from-[#004D98] to-[#A50044] rounded-full flex items-center justify-center p-1 shadow-lg shadow-blue-500/20">
              <div className="bg-[#1E293B] w-full h-full rounded-full flex items-center justify-center">
                <span className="text-[#D4AF37] font-bold text-2xl italic">
                  FL
                </span>
              </div>
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Futebol<span className="text-[#D4AF37]">Lar</span>
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            A sua arena digital de organização.
          </p>
        </div>

        {/* Formulário */}
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 ml-1"
              >
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-4 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all sm:text-sm"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 ml-1"
              >
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full px-4 py-3 bg-[#0F172A] border border-[#334155] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent transition-all sm:text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                className="h-4 w-4 text-[#D4AF37] focus:ring-[#D4AF37] border-gray-700 rounded bg-[#0F172A]"
              />
              <label htmlFor="remember-me" className="ml-2 text-gray-400">
                Lembrar de mim
              </label>
            </div>
            <a
              href="#"
              className="font-medium text-[#D4AF37] hover:text-[#f3cd5d] transition-colors"
            >
              Esqueceu a senha?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-[#0F172A] bg-[#D4AF37] hover:bg-[#f3cd5d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D4AF37] transition-all transform active:scale-95 ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {loading ? "Entrando..." : "ENTRAR NA ARENA"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            Não tem uma conta?{" "}
            <a href="#" className="font-bold text-white hover:underline">
              Cadastre-se grátis
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
