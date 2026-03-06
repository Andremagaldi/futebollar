"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Game {
  id: string;
  game_date: string;
  votacao_encerrada: boolean | null;
  mvp_user_id: string | null;
}

interface PlayerUser {
  id: string;
  name: string;
  tipo: string;
  stars: number | null;
}

interface Player {
  id: string;
  user_id: string;
  users: PlayerUser | null;
}

interface PlayerRow extends Omit<Player, "users"> {
  users: PlayerUser | PlayerUser[] | null;
}

export default function VotacaoMVP() {
  const [game, setGame] = useState<Game | null>(null);
  const [jogadores, setJogadores] = useState<Player[]>([]);
  const [votos, setVotos] = useState<Record<string, number>>({});
  const [meuVoto, setMeuVoto] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [participou, setParticipou] = useState(false);
  const [loading, setLoading] = useState(true);
  const [votando, setVotando] = useState(false);
  const [encerrada, setEncerrada] = useState(false);
  const [mvpOficial, setMvpOficial] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    setLoading(true);

    // Usuário logado
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);

    // Verifica se é admin
    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    setIsAdmin(userData?.role === "admin");

    // Jogo mais recente
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
    setGame(latestGame as Game);
    setEncerrada(latestGame.votacao_encerrada || false);
    setMvpOficial(latestGame.mvp_user_id || null);

    // Jogadores confirmados nesse jogo
    const { data: players } = await supabase
      .from("game_players")
      .select("*, users(id, name, tipo, stars)")
      .eq("game_id", latestGame.id)
      .eq("status", "confirmado");
    const jogadoresNormalizados =
      (players as PlayerRow[] | null)?.map((player) => ({
        ...player,
        users: Array.isArray(player.users) ? player.users[0] ?? null : player.users,
      })) ?? [];
    setJogadores(jogadoresNormalizados);

    // Verifica se o usuário participou
    const participou = jogadoresNormalizados.some((p) => p.user_id === user.id);
    setParticipou(participou);

    // Busca todos os votos do jogo
    const { data: votosData } = await supabase
      .from("mvp_votes")
      .select("voted_for")
      .eq("game_id", latestGame.id);

    const contagem: Record<string, number> = {};
    votosData?.forEach((v: { voted_for: string }) => {
      contagem[v.voted_for] = (contagem[v.voted_for] || 0) + 1;
    });
    setVotos(contagem);

    // Verifica se o usuário já votou
    const { data: meuVotoData } = await supabase
      .from("mvp_votes")
      .select("voted_for")
      .eq("game_id", latestGame.id)
      .eq("voter_id", user.id)
      .single();
    setMeuVoto(meuVotoData?.voted_for || null);

    setLoading(false);
  }

  async function votar(votedForId: string) {
    if (!game || !userId || !participou || meuVoto || encerrada || votedForId === userId)
      return;
    setVotando(true);

    const { error } = await supabase.from("mvp_votes").insert({
      game_id: game.id,
      voter_id: userId,
      voted_for: votedForId,
    });

    if (!error) {
      setMeuVoto(votedForId);
      setVotos((prev) => ({
        ...prev,
        [votedForId]: (prev[votedForId] || 0) + 1,
      }));
    }
    setVotando(false);
  }

  async function encerrarVotacao() {
    if (!game) return;
    // Encontra o MVP (mais votos)
    const mvpId = Object.entries(votos).sort((a, b) => b[1] - a[1])[0]?.[0];
    await supabase
      .from("games")
      .update({
        votacao_encerrada: true,
        mvp_user_id: mvpId,
      })
      .eq("id", game.id);

    // Incrementa mvp_count do jogador
    if (mvpId) {
      const { data: u } = await supabase
        .from("users")
        .select("mvp_count")
        .eq("id", mvpId)
        .single();
      await supabase
        .from("users")
        .update({ mvp_count: (u?.mvp_count || 0) + 1 })
        .eq("id", mvpId);
    }

    setEncerrada(true);
    setMvpOficial(mvpId);
  }

  const totalVotos = Object.values(votos).reduce((a, b) => a + b, 0);
  const jogadoresOrdenados = [...jogadores].sort((a, b) => {
    return (votos[b.user_id] || 0) - (votos[a.user_id] || 0);
  });

  const mvpJogador = jogadores.find((j) => j.user_id === mvpOficial);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1117] via-[#0d1117] to-[#1a0a00] text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;700;900&family=DM+Sans:wght@400;500&display=swap');
        .font-exo { font-family: 'Exo 2', sans-serif; }
        body { font-family: 'DM Sans', sans-serif; }
        @keyframes pulse-gold { 0%,100% { box-shadow: 0 0 20px rgba(245,197,24,0.3); } 50% { box-shadow: 0 0 40px rgba(245,197,24,0.6); } }
        .pulse-gold { animation: pulse-gold 2s infinite; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.35s ease forwards; }
      `}</style>

      {/* Header */}
      <header className="border-b border-white/5 bg-black/30 backdrop-blur sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-exo font-900 text-2xl text-white">
              Votação <span className="text-amber-400">MVP</span>
            </h1>
            <p className="text-zinc-500 text-xs">
              {game
                ? new Date(game.game_date).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  })
                : "Carregando..."}
            </p>
          </div>
          {isAdmin && !encerrada && totalVotos > 0 && (
            <button
              onClick={encerrarVotacao}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 text-sm font-semibold hover:bg-amber-500/30 transition-all"
            >
              🏁 Encerrar votação
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {loading && (
          <div className="text-center py-20 text-zinc-600 animate-pulse">
            Carregando...
          </div>
        )}

        {!loading && !game && (
          <div className="text-center py-20 text-zinc-600">
            Nenhuma partida encontrada.
          </div>
        )}

        {!loading && game && (
          <>
            {/* MVP oficial (após encerrar) */}
            {encerrada && mvpJogador && (
              <div className="rounded-3xl border-2 border-amber-400/50 bg-amber-400/10 pulse-gold p-6 text-center fade-up">
                <p className="text-amber-400/70 text-xs uppercase tracking-widest mb-2">
                  MVP da Partida
                </p>
                <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-3xl font-bold text-amber-400 mx-auto mb-3">
                  {(mvpJogador.users?.name || "?")[0].toUpperCase()}
                </div>
                <p className="text-2xl font-exo font-bold text-white">
                  {mvpJogador.users?.name}
                </p>
                <p className="text-amber-400 text-sm mt-1">
                  🏆 {votos[mvpJogador.user_id] || 0} votos
                </p>
              </div>
            )}

            {/* Status da votação */}
            {!participou && !isAdmin && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 text-center text-zinc-400 text-sm">
                ⚽ Apenas jogadores que participaram da partida podem votar.
              </div>
            )}

            {participou && meuVoto && !encerrada && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center text-emerald-400 text-sm">
                ✅ Seu voto foi registrado!
              </div>
            )}

            {encerrada && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 text-center text-zinc-400 text-sm">
                🏁 Votação encerrada · {totalVotos} voto(s) no total
              </div>
            )}

            {/* Lista de jogadores */}
            <div className="space-y-2">
              {jogadoresOrdenados.map((j, idx) => {
                const qtd = votos[j.user_id] || 0;
                const pct = totalVotos > 0 ? (qtd / totalVotos) * 100 : 0;
                const isMe = j.user_id === userId;
                const jaMeuVoto = meuVoto === j.user_id;
                const isMvp = mvpOficial === j.user_id;
                const podeVotar = participou && !meuVoto && !encerrada && !isMe;

                return (
                  <div
                    key={j.id}
                    onClick={() => podeVotar && votar(j.user_id)}
                    className={`relative rounded-2xl border p-4 transition-all fade-up overflow-hidden ${
                      isMvp
                        ? "border-amber-400/50 bg-amber-400/10"
                        : jaMeuVoto
                          ? "border-emerald-500/40 bg-emerald-500/10"
                          : podeVotar
                            ? "border-white/10 bg-white/[0.03] cursor-pointer hover:border-amber-400/40 hover:bg-amber-400/5"
                            : "border-white/5 bg-white/[0.02]"
                    }`}
                    style={{ animationDelay: `${idx * 0.05}s` }}
                  >
                    {/* Barra de progresso de fundo */}
                    {(encerrada || meuVoto) && (
                      <div
                        className="absolute inset-0 bg-amber-400/5 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    )}

                    <div className="relative flex items-center gap-3">
                      {/* Posição */}
                      {(encerrada || meuVoto) && (
                        <span
                          className={`text-sm font-bold w-5 text-center ${idx === 0 ? "text-amber-400" : "text-zinc-600"}`}
                        >
                          {idx + 1}
                        </span>
                      )}

                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          isMvp
                            ? "bg-amber-400/30 border-2 border-amber-400 text-amber-300"
                            : "bg-zinc-800 border border-zinc-700 text-zinc-300"
                        }`}
                      >
                        {(j.users?.name || "?")[0].toUpperCase()}
                      </div>

                      {/* Nome */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-semibold">
                            {j.users?.name}
                          </p>
                          {isMe && (
                            <span className="text-xs text-zinc-600">
                              (você)
                            </span>
                          )}
                          {isMvp && (
                            <span className="text-xs text-amber-400">
                              🏆 MVP
                            </span>
                          )}
                          {jaMeuVoto && (
                            <span className="text-xs text-emerald-400">
                              ✓ seu voto
                            </span>
                          )}
                        </div>
                        {(encerrada || meuVoto) && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 bg-zinc-800 rounded-full h-1">
                              <div
                                className="h-1 rounded-full bg-amber-400 transition-all duration-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-500 w-12 text-right">
                              {qtd} voto{qtd !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Botão votar */}
                      {podeVotar && !votando && (
                        <span className="text-zinc-600 text-xs">Votar →</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
