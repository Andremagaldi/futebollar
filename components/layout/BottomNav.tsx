"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", icon: "⚽", label: "Início" },
  { href: "/lista", icon: "📋", label: "Lista" },
  { href: "/sorteio", icon: "🎲", label: "Sorteio" },
  { href: "/ranking", icon: "🏆", label: "Ranking" },
  { href: "/perfil", icon: "👤", label: "Perfil" },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around px-2 pt-2.5 pb-4 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
      {NAV.map(({ href, icon, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-0.5 min-w-[56px] group"
          >
            <span
              className={`text-xl transition-all duration-200 group-active:scale-90 ${active ? "" : "opacity-40"}`}
            >
              {icon}
            </span>
            <span
              className={`text-[10px] font-semibold tracking-wide transition-colors ${active ? "text-yellow-500" : "text-gray-400 dark:text-gray-600"}`}
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
