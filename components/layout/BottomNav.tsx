"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Role = "jogador" | "gerente" | "admin";

const NAV_JOGADOR = [
  { href: "/jogo", icon: "🏠", label: "Jogo" },
  { href: "/lista", icon: "📋", label: "Lista" },
  { href: "/ranking", icon: "🏆", label: "Ranking" },
  { href: "/pagamento", icon: "💳", label: "Pagar" },
  { href: "/perfil", icon: "👤", label: "Perfil" },
];

const NAV_GERENTE = [
  { href: "/jogo", icon: "🏠", label: "Jogo" },
  { href: "/lista", icon: "📋", label: "Lista" },
  { href: "/admin/financeiro", icon: "💼", label: "Gestão" },
  { href: "/pagamento", icon: "💳", label: "Pagar" },
  { href: "/perfil", icon: "👤", label: "Perfil" },
];

const NAV_ADMIN = [
  { href: "/jogo", icon: "🏠", label: "Jogo" },
  { href: "/lista", icon: "📋", label: "Lista" },
  { href: "/admin", icon: "⚙️", label: "Admin" },
  { href: "/pagamento", icon: "💳", label: "Pagar" },
  { href: "/perfil", icon: "👤", label: "Perfil" },
];

function navByRole(role: Role) {
  if (role === "admin") return NAV_ADMIN;
  if (role === "gerente") return NAV_GERENTE;
  return NAV_JOGADOR;
}

export default function BottomNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("jogador");

  useEffect(() => {
    async function fetchRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();
      if (data?.role) setRole(data.role as Role);
    }
    fetchRole();
  }, []);

  const nav = navByRole(role);

  // Não mostrar BottomNav no login e no telão
  if (pathname === "/" || pathname === "/telao") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around px-2 pt-2.5 pb-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
      {nav.map(({ href, icon, label }) => {
        // Ativo se rota exata ou se começa com o href (para subrotas de /admin)
        const active =
          pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-0.5 min-w-[56px] group"
          >
            <span
              className={`text-xl transition-all duration-200 group-active:scale-90 ${
                active ? "" : "opacity-40"
              }`}
            >
              {icon}
            </span>
            <span
              className={`text-[10px] font-semibold tracking-wide transition-colors ${
                active ? "text-yellow-500" : "text-gray-400 dark:text-gray-600"
              }`}
            >
              {label}
            </span>
            {active && (
              <span className="w-1 h-1 rounded-full bg-yellow-500 mt-0.5" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
