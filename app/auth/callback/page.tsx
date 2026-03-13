"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Supabase lê automaticamente o fragmento #access_token da URL
    // e estabelece a sessão. Só precisamos aguardar e redirecionar.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/jogo");
      } else {
        // Aguarda um momento para o Supabase processar o fragmento
        const timer = setTimeout(() => {
          router.replace("/jogo");
        }, 1500);
        return () => clearTimeout(timer);
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Entrando...</p>
      </div>
    </div>
  );
}
