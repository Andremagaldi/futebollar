"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Role = "jogador" | "gerente" | "admin";

const ROLE_LEVEL: Record<Role, number> = {
  jogador: 1,
  gerente: 2,
  admin: 3,
};

interface Props {
  children: React.ReactNode;
  requiredRole?: Role; // mínimo necessário para acessar
}

export default function ProtectedRoute({
  children,
  requiredRole = "jogador",
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">(
    "loading",
  );

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/");
        return;
      }

      // Se não exige role específica além de "jogador", já libera
      if (requiredRole === "jogador") {
        setStatus("allowed");
        return;
      }

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      const userRole = (data?.role as Role) ?? "jogador";
      const userLevel = ROLE_LEVEL[userRole];
      const requiredLevel = ROLE_LEVEL[requiredRole];

      if (userLevel >= requiredLevel) {
        setStatus("allowed");
      } else {
        setStatus("denied");
      }
    }
    check();
  }, [requiredRole, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
