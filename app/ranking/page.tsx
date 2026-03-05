"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function StarRating({ value, onChange, readonly = false }) {
  const [hovered, setHovered] = useState(null);
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
          className={`text-xl transition-all duration-100 ${readonly ? "cursor-default" : "cursor-pointer hover:scale-125"} ${
            s <= display ? "text-amber-400" : "text-zinc-700"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function RankingJogadores() {
  const [jogadores, setJogadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState("stars_desc");

  async function fetchJogadores() {
    setLoading(true);
    const { data } = await supabase
      .from("users")
      .select("id, name, tipo, stars, mvp_count")
      .order("stars", { ascending: false });
    setJogadores(data || []);
    setLoading(false);
  }

  async function updateStars(userId, stars) {
    setSaving(userId);
    await supabase.from("users").update({ stars }).eq("id", userId);
    setJogadores((prev) =>
      prev.map((j) => (j.id === userId ? { ...j, stars } : j)),
    );
    setSaving(null);
  }

  useEffect(() => {
    fetchJogadores();
  }, []);

  const filtrados = jogadores
    .filter((j) => j.name?.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => {
      if (ordem === "stars_desc") return (b.stars || 0) - (a.stars || 0);
      if (ordem === "stars_asc") return (a.stars || 0) - (b.stars || 0);
      if (ordem === "mvp_desc") return (b.mvp_count || 0) - (a.mvp_count || 0);
      if (ordem === "nome") return a.name?.localeCompare(b.name);
      return 0;
    });

  const top3 = [...jogadores]
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, 3);
  const podiumOrder = [1, 0, 2]; // prata, ouro, bronze

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@400;500;600&display=swap');
        .font-bebas { font-family: 'Bebas Neue', sans-serif; }
        body { font-family: 'Outfit', sans-serif; }
        .gold { color: #f5c518; }
        .silver { color: #c0c0c0; }
        .bronze { color: #cd7f32; }
        .card-glow:hover { box-shadow: 0 0 30px rgba(245,197,24,0.1); }
        @keyframes rise { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
        .rise { animation: rise 0.4s ease forwards; }
      `}</style>

      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-bebas text-3xl tracking-widest gold">
              Ranking
            </h1>
            <p className="text-zinc-500 text-xs -mt-1">
              Futebol Lar Cristão · Temporada atual
            </p>
          </div>
          <button
            onClick={fetchJogadores}
            className="text-zinc-500 hover:text-white text-sm transition-colors"
          >
            🔄
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Pódio top 3 */}
        {!loading && top3.length >= 3 && (
          <div className="flex items-end justify-center gap-4 py-6">
            {podiumOrder.map((idx) => {
              const j = top3[idx];
              const medals = ["🥇", "🥈", "🥉"];
              const heights = ["h-28", "h-36", "h-20"];
              const colors = [
                "border-[#c0c0c0]/40 bg-[#c0c0c0]/5",
                "border-[#f5c518]/40 bg-[#f5c518]/10",
                "border-[#cd7f32]/40 bg-[#cd7f32]/5",
              ];
              const labelColors = ["silver", "gold", "bronze"];
              return (
                <div
                  key={j.id}
                  className="flex flex-col items-center gap-2 rise"
                >
                  <span className="text-2xl">{medals[idx]}</span>
                  <div
                    className={`w-24 rounded-xl border ${colors[idx]} flex flex-col items-center justify-end pb-3 pt-2 ${heights[idx]}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center font-bold text-lg mb-1">
                      {(j.name || "?")[0].toUpperCase()}
                    </div>
                    <p className="text-xs font-semibold text-center truncate px-1 w-full text-center">
                      {j.name?.split(" ")[0]}
                    </p>
                    <p className={`text-xs ${labelColors[idx]}`}>
                      {"★".repeat(j.stars || 0)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar jogador..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50"
          />
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-zinc-300 focus:outline-none"
          >
            <option value="stars_desc">⭐ Mais estrelas</option>
            <option value="stars_asc">⭐ Menos estrelas</option>
            <option value="mvp_desc">🏆 Mais MVPs</option>
            <option value="nome">🔤 Nome A-Z</option>
          </select>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-16 text-zinc-600 animate-pulse">
            Carregando ranking...
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map((j, idx) => (
              <div
                key={j.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border border-white/5 bg-white/[0.02] card-glow transition-all ${
                  saving === j.id ? "opacity-60" : ""
                }`}
              >
                {/* Posição */}
                <span
                  className={`text-sm font-bebas w-6 text-center ${
                    idx === 0
                      ? "gold text-xl"
                      : idx === 1
                        ? "silver"
                        : idx === 2
                          ? "bronze"
                          : "text-zinc-600"
                  }`}
                >
                  {idx + 1}
                </span>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300 shrink-0">
                  {(j.name || "?")[0].toUpperCase()}
                </div>

                {/* Nome e tipo */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {j.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs ${j.tipo === "mensalista" ? "text-blue-400" : "text-zinc-500"}`}
                    >
                      {j.tipo || "avulso"}
                    </span>
                    {(j.mvp_count || 0) > 0 && (
                      <span className="text-xs text-amber-500">
                        🏆 {j.mvp_count}× MVP
                      </span>
                    )}
                  </div>
                </div>

                {/* Estrelas editáveis */}
                <div className="flex flex-col items-end gap-1">
                  <StarRating
                    value={j.stars || 0}
                    onChange={(s) => updateStars(j.id, s)}
                  />
                  <span className="text-zinc-600 text-xs">
                    {j.stars || 0}/5 estrelas
                  </span>
                </div>
              </div>
            ))}
            {filtrados.length === 0 && (
              <div className="text-center py-10 text-zinc-600 text-sm">
                Nenhum jogador encontrado.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
