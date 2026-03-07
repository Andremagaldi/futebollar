"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/layout/PageHeader";
import BottomNav from "@/components/layout/BottomNav";

interface Jogador {
  id: string;
  name: string;
  tipo: string;
  stars: number | null;
  mvp_count: number | null;
}

type Ordenacao = "stars_desc" | "stars_asc" | "mvp_desc" | "nome";

// ── StarRating ─────────────────────────────────────────────
function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          disabled={readonly}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => !readonly && setHovered(s)}
          onMouseLeave={() => !readonly && setHovered(null)}
          className={`text-lg transition-all duration-100 ${
            readonly ? "cursor-default" : "cursor-pointer hover:scale-125"
          } ${s <= display ? "text-yellow-400" : "text-gray-300 dark:text-gray-700"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ── Pódio card ─────────────────────────────────────────────
function PodiumCard({
  jogador,
  place,
}: {
  jogador: Jogador;
  place: 1 | 2 | 3;
}) {
  const configs = {
    1: {
      height: "h-36",
      avatar: "bg-gradient-to-br from-yellow-400 to-yellow-600",
      border: "border-yellow-400/40 bg-yellow-400/5 dark:bg-yellow-400/10",
      medal: "🥇",
      label: "text-yellow-500",
    },
    2: {
      height: "h-28",
      avatar: "bg-gradient-to-br from-gray-400 to-gray-500",
      border: "border-gray-400/40 bg-gray-400/5 dark:bg-gray-400/10",
      medal: "🥈",
      label: "text-gray-400",
    },
    3: {
      height: "h-20",
      avatar: "bg-gradient-to-br from-orange-400 to-orange-600",
      border: "border-orange-400/40 bg-orange-400/5 dark:bg-orange-400/10",
      medal: "🥉",
      label: "text-orange-500",
    },
  };
  const cfg = configs[place];

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-2xl">{cfg.medal}</span>
      <div
        className={`w-24 rounded-2xl border ${cfg.border} ${cfg.height} flex flex-col items-center justify-end pb-3 pt-2 transition-all`}
      >
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-lg mb-1 ${cfg.avatar}`}
        >
          {(jogador.name || "?")[0].toUpperCase()}
        </div>
        <p className="text-xs font-semibold text-center truncate px-1 w-full text-gray-900 dark:text-white">
          {jogador.name?.split(" ")[0]}
        </p>
        <p className={`text-xs ${cfg.label}`}>
          {"★".repeat(jogador.stars || 0)}
        </p>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────
export default function RankingPage() {
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordenacao>("stars_desc");

  useEffect(() => {
    fetchJogadores();
  }, []);

  async function fetchJogadores() {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, name, tipo, stars, mvp_count")
      .order("stars", { ascending: false });
    setJogadores((data as Jogador[] | null) || []);
    setLoading(false);
  }

  async function updateStars(userId: string, stars: number) {
    setSaving(userId);
    await supabase.from("users").update({ stars }).eq("id", userId);
    setJogadores((prev) =>
      prev.map((j) => (j.id === userId ? { ...j, stars } : j)),
    );
    setSaving(null);
  }

  const top3 = [...jogadores]
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, 3);

  const filtrados = jogadores
    .filter((j) => j.name?.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => {
      if (ordem === "stars_desc") return (b.stars || 0) - (a.stars || 0);
      if (ordem === "stars_asc") return (a.stars || 0) - (b.stars || 0);
      if (ordem === "mvp_desc") return (b.mvp_count || 0) - (a.mvp_count || 0);
      if (ordem === "nome") return (a.name || "").localeCompare(b.name || "");
      return 0;
    });

  const MEDAL_COLORS = ["text-yellow-500", "text-gray-400", "text-orange-500"];

  return (
    <div className="min-h-screen pb-24 bg-gray-50 dark:bg-gray-950">
      <PageHeader
        title="RANKING"
        subtitle="Futebol Lar Cristão · Temporada atual"
        rightSlot={
          <button
            onClick={fetchJogadores}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors active:scale-95"
          >
            🔄
          </button>
        }
      />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ── Pódio Top 3 ── */}
        {!loading && top3.length >= 3 && (
          <div className="flex items-end justify-center gap-4 py-4">
            <PodiumCard jogador={top3[1]} place={2} />
            <PodiumCard jogador={top3[0]} place={1} />
            <PodiumCard jogador={top3[2]} place={3} />
          </div>
        )}

        {/* ── Filtros ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="🔍 Buscar jogador..."
            className="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
          />
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as Ordenacao)}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
          >
            <option value="stars_desc">⭐ Mais estrelas</option>
            <option value="stars_asc">⭐ Menos estrelas</option>
            <option value="mvp_desc">🏆 Mais MVPs</option>
            <option value="nome">🔤 Nome A-Z</option>
          </select>
        </div>

        {/* ── Lista ── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-20 rounded-2xl animate-pulse bg-gray-200 dark:bg-gray-800"
              />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold text-gray-500 dark:text-gray-600">
              Nenhum jogador encontrado.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((j, idx) => (
              <div
                key={j.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                  saving === j.id ? "opacity-60" : ""
                } ${
                  idx === 0
                    ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/40"
                    : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                } hover:shadow-md`}
              >
                {/* Posição */}
                <span
                  className={`text-sm font-display w-6 text-center flex-shrink-0 ${
                    idx < 3
                      ? MEDAL_COLORS[idx]
                      : "text-gray-400 dark:text-gray-600"
                  } ${idx === 0 ? "text-xl" : ""}`}
                >
                  {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : `#${idx + 1}`}
                </span>

                {/* Avatar */}
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-base flex-shrink-0 ${
                    idx === 0
                      ? "bg-gradient-to-br from-yellow-400 to-yellow-600"
                      : idx === 1
                        ? "bg-gradient-to-br from-gray-400 to-gray-500"
                        : idx === 2
                          ? "bg-gradient-to-br from-orange-400 to-orange-600"
                          : "bg-gradient-to-br from-blue-500 to-blue-700"
                  }`}
                >
                  {(j.name || "?")[0].toUpperCase()}
                </div>

                {/* Nome + tipo */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                    {j.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className={`text-xs font-medium ${
                        j.tipo === "mensalista"
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-400 dark:text-gray-600"
                      }`}
                    >
                      {j.tipo === "mensalista" ? "📅 Mensalista" : "💳 Avulso"}
                    </span>
                    {(j.mvp_count || 0) > 0 && (
                      <span className="text-xs text-yellow-600 dark:text-yellow-400">
                        🏆 {j.mvp_count}× MVP
                      </span>
                    )}
                  </div>
                </div>

                {/* Estrelas editáveis */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <StarRating
                    value={j.stars || 0}
                    onChange={(s) => updateStars(j.id, s)}
                  />
                  <span className="text-xs text-gray-400 dark:text-gray-600">
                    {j.stars || 0}/5
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
