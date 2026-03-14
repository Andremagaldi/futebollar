"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "jogador" | "gerente" | "admin";
type CheckStatus = "loading" | "allowed" | "denied" | "pendente" | "rejeitado";

const ROLE_LEVEL: Record<Role, number> = {
  jogador: 1,
  gerente: 2,
  admin: 3,
};

interface Props {
  children: React.ReactNode;
  requiredRole?: Role;
}

export default function ProtectedRoute({
  children,
  requiredRole = "jogador",
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<CheckStatus>("loading");

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      // Busca status + role do usuário
      const { data } = await supabase
        .from("users")
        .select("role, status")
        .eq("id", user.id)
        .single();

      // Bloqueia pendentes e rejeitados
      if (data?.status === "pendente") {
        setStatus("pendente");
        return;
      }
      if (data?.status === "rejeitado") {
        setStatus("rejeitado");
        return;
      }

      // Verifica role
      const userRole = (data?.role as Role) ?? "jogador";
      const userLevel = ROLE_LEVEL[userRole];
      const requiredLevel = ROLE_LEVEL[requiredRole];

      if (userLevel >= requiredLevel) setStatus("allowed");
      else setStatus("denied");
    }
    check();
  }, [requiredRole, router]);

  // ── Loading ──
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Cadastro pendente ──
  if (status === "pendente") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-8 text-center">
        <p className="text-6xl mb-5">⏳</p>
        <p className="font-display text-2xl text-gray-900 dark:text-white mb-2">
          AGUARDANDO APROVAÇÃO
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          Seu cadastro foi recebido e está sendo analisado pelo administrador.
          Em breve você receberá uma confirmação no WhatsApp.
        </p>
        <div className="w-full max-w-xs bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-left space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-lg">✅</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Cadastro criado
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg">⏳</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Aguardando aprovação do admin
            </p>
          </div>
          <div className="flex items-center gap-3 opacity-40">
            <span className="text-lg">⚽</span>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Acesso liberado
            </p>
          </div>
        </div>
        <button
          onClick={() =>
            supabase.auth.signOut().then(() => router.replace("/"))
          }
          className="mt-8 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Sair da conta
        </button>
      </div>
    );
  }

  // ── Cadastro rejeitado ──
  if (status === "rejeitado") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-8 text-center">
        <p className="text-6xl mb-5">❌</p>
        <p className="font-display text-2xl text-gray-900 dark:text-white mb-2">
          CADASTRO NÃO APROVADO
        </p>
        <p className="text-sm text-gray-400 leading-relaxed mb-6">
          Seu cadastro não foi aprovado pelo administrador. Entre em contato
          para mais informações.
        </p>
        <button
          onClick={() =>
            supabase.auth.signOut().then(() => router.replace("/"))
          }
          className="px-6 py-3 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm active:scale-95 transition-all"
        >
          Sair da conta
        </button>
      </div>
    );
  }

  // ── Sem permissão de role ──
  if (status === "denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 px-8 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-display text-2xl text-gray-900 dark:text-white mb-2">
          ACESSO RESTRITO
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Você não tem permissão para acessar esta página.
        </p>
        <button
          onClick={() => router.push("/jogo")}
          className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:scale-95 transition-all"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
