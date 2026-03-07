"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const isDark = theme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`relative w-12 h-6 rounded-full flex items-center px-1 transition-all duration-300 ${
        isDark ? "bg-blue-600" : "bg-yellow-400"
      }`}
      aria-label="Alternar tema"
    >
      <span
        className="w-4 h-4 rounded-full bg-white shadow flex items-center justify-center text-[9px] transition-all duration-300"
        style={{ transform: isDark ? "translateX(24px)" : "translateX(0)" }}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
