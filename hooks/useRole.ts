"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type Role = "jogador" | "gerente" | "admin";

const ROLE_LEVEL: Record<Role, number> = {
  jogador: 1,
  gerente: 2,
  admin:   3,
};

interface UseRoleReturn {
  role: Role;
  isAdmin: boolean;
  isGerente: boolean;
  isJogador: boolean;
  hasAccess: (required: Role) => boolean;
  loading: boolean;
  userId: string | null;
}

export function useRole(): UseRoleReturn {
  const [role, setRole]     = useState<Role>("jogador");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (data?.role) setRole(data.role as Role);
      setLoading(false);
    }
    fetch();
  }, []);

  return {
    role,
    isAdmin:   role === "admin",
    isGerente: role === "gerente" || role === "admin",
    isJogador: true, // todos são jogadores
    hasAccess: (required: Role) => ROLE_LEVEL[role] >= ROLE_LEVEL[required],
    loading,
    userId,
  };
}