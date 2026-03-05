"use client";

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

// ─── Formata os times em texto para WhatsApp ───────────────────
function formatarParaWhatsApp(times, game) {
  const data = game?.game_date
    ? new Date(game.game_date).toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })
    : "Próxima partida";

  const capitalizar = (s) => s?.charAt(0).toUpperCase() + s?.slice(1);

  let texto = `⚽ *FUTEBOL LAR CRISTÃO*\n`;
  texto += `📅 ${capitalizar(data)}\n`;
  texto += `${"─".repeat(28)}\n\n`;

  times.forEach((time, idx) => {
    const emoji = ["🔵", "🔴", "🟡", "🟢", "🟠"][idx] || "⚪";
    texto += `${emoji} *${time.nome.toUpperCase()}*\n`;
    time.jogadores.forEach((j, i) => {
      const pos = j.posicao === "goleiro" ? "🧤" : `${i}.`;
      texto += `  ${pos} ${j.nome}\n`;
    });
    texto += `\n`;
  });

  texto += `${"─".repeat(28)}\n`;
  texto += `✨ Bom jogo a todos! 🙏`;
  return texto;
}

export default function ExportarTimes() {
  const [game, setGame] = useState(null);
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    fetchTimes();
  }, []);

  async function fetchTimes() {
    setLoading(true);

    const { data: games } = await supabase
      .from("games")
      .select("*")
      .order("game_date", { ascending: false })
      .limit(1);
    const latestGame = games?.[0];
    if (!latestGame) {
      setLoading(false);
      return;
    }
    setGame(latestGame);

    // Busca times sorteados
    const { data: timesData } = await supabase
      .from("times_sorteados")
      .select("*")
      .eq("game_id", latestGame.id);

    if (!timesData || timesData.length === 0) {
      setLoading(false);
      return;
    }

    // Busca os jogadores de cada time
    const timesFormatados = await Promise.all(
      timesData.map(async (time) => {
        const jogadorIds = time.jogadores_ids || [];
        const { data: jogadores } = await supabase
          .from("users")
          .select("id, name")
          .in("id", jogadorIds);

        // Busca posições dos jogadores no jogo
        const { data: gp } = await supabase
          .from("game_players")
          .select("user_id, posicao")
          .eq("game_id", latestGame.id)
          .in("user_id", jogadorIds);

        const posMap = {};
        gp?.forEach((p) => {
          posMap[p.user_id] = p.posicao;
        });

        return {
          nome: time.nome || `Time ${time.numero || ""}`,
          jogadores: (jogadores || [])
            .map((j) => ({
              nome: j.name,
              posicao: posMap[j.id] || "linha",
            }))
            .sort((a, b) => (a.posicao === "goleiro" ? -1 : 1)),
        };
      }),
    );

    setTimes(timesFormatados);
    setPreview(formatarParaWhatsApp(timesFormatados, latestGame));
    setLoading(false);
  }

  async function copiarTexto() {
    try {
      await navigator.clipboard.writeText(preview);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = preview;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  }

  function abrirWhatsApp() {
    const encoded = encodeURIComponent(preview);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-[#111b21] text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .wa-green { color: #25d366; }
        .wa-bg { background: #25d366; }
        .bubble { background: #1f2c33; border-radius: 0 12px 12px 12px; }
        @keyframes pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .pop { animation: pop 0.3s ease; }
      `}</style>

      {/* Header estilo WhatsApp */}
      <header className="bg-[#1f2c33] px-4 py-4 flex items-center gap-3 border-b border-white/5">
        <div className="w-10 h-10 rounded-full bg-[#25d366]/20 border border-[#25d366]/30 flex items-center justify-center text-xl">
          ⚽
        </div>
        <div>
          <h1 className="font-bold text-white text-sm">Futebol Lar Cristão</h1>
          <p className="text-[#8696a0] text-xs">Compartilhar times</p>
        </div>
        <button
          onClick={fetchTimes}
          className="ml-auto text-[#8696a0] hover:text-white transition-colors"
        >
          🔄
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="text-center py-16 text-[#8696a0] animate-pulse text-sm">
            Carregando times...
          </div>
        )}

        {!loading && times.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <p className="text-4xl">🎲</p>
            <p className="text-[#8696a0] text-sm">
              Nenhum time sorteado ainda.
            </p>
            <p className="text-[#8696a0] text-xs">
              Realize o sorteio primeiro.
            </p>
          </div>
        )}

        {!loading && times.length > 0 && (
          <>
            {/* Times visualizados como cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {times.map((time, idx) => {
                const emojis = ["🔵", "🔴", "🟡", "🟢", "🟠"];
                const colors = [
                  "border-blue-500/30 bg-blue-500/5",
                  "border-red-500/30 bg-red-500/5",
                  "border-yellow-500/30 bg-yellow-500/5",
                  "border-emerald-500/30 bg-emerald-500/5",
                  "border-orange-500/30 bg-orange-500/5",
                ];
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-4 ${colors[idx % colors.length]}`}
                  >
                    <p className="font-bold text-white text-sm mb-3">
                      {emojis[idx]} {time.nome}
                    </p>
                    <div className="space-y-1.5">
                      {time.jogadores.map((j, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-sm">
                            {j.posicao === "goleiro" ? "🧤" : "👟"}
                          </span>
                          <span className="text-zinc-300 text-sm">
                            {j.nome}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview da mensagem WhatsApp */}
            <div className="space-y-3">
              <p className="text-[#8696a0] text-xs uppercase tracking-widest">
                Preview da mensagem
              </p>
              <div className="bubble p-4 pop">
                <pre className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {preview}
                </pre>
                <p className="text-[#8696a0] text-xs text-right mt-2">
                  {new Date().toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  ✓✓
                </p>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={copiarTexto}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all border ${
                  copiado
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : "bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10"
                }`}
              >
                {copiado ? "✅ Copiado!" : "📋 Copiar texto"}
              </button>

              <button
                onClick={abrirWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm wa-bg text-white hover:opacity-90 transition-all"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Enviar pelo WhatsApp
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
