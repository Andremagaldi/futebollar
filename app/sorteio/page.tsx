"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import ProtectedRoute from "@/components/ProtectedRoute";
import { sortearTimes } from "@/lib/sortearTimes";

type Player = {
  id: string;
  users: {
    nome_completo: string;
    posicao: string;
  } | null;
};

type Time = {
  nome: string;
  jogadores: Player[];
};

export default function SorteioPage() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [sorteioConfirmado, setSorteioConfirmado] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // 🔎 Buscar último jogo
      const { data: games } = await supabase
        .from("games")
        .select("*")
        .order("data_jogo", { ascending: false })
        .limit(1);

      if (!games || games.length === 0) {
        setLoading(false);
        return;
      }

      const game = games[0];
      setGameId(game.id);
      setSorteioConfirmado(game.sorteio_confirmado);

      // 👤 Verificar se é admin
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("is_admin")
          .eq("id", user.id)
          .single();

        if (profile?.is_admin) {
          setIsAdmin(true);
        }
      }

      if (game.sorteio_confirmado) {
        // 🔒 Buscar times oficiais
        const { data: oficiais } = await supabase
          .from("times_sorteados")
          .select(
            `
            nome_time,
            users (
              nome_completo,
              posicao
            )
          `,
          )
          .eq("game_id", game.id);

        const agrupados: Record<string, Player[]> = {};

        oficiais?.forEach((item: any) => {
          if (!agrupados[item.nome_time]) {
            agrupados[item.nome_time] = [];
          }

          agrupados[item.nome_time].push({
            id: crypto.randomUUID(),
            users: item.users,
          });
        });

        const timesFormatados = Object.keys(agrupados).map((nome) => ({
          nome,
          jogadores: agrupados[nome],
        }));

        setTimes(timesFormatados);
      } else {
        // 🔎 Buscar confirmados
        const { data: jogadores } = await supabase
          .from("game_players")
          .select(
            `
            id,
            users (
              nome_completo,
              posicao
            )
          `,
          )
          .eq("game_id", game.id)
          .eq("status", "confirmado");

        setPlayers(jogadores || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // 🎲 Gerar sorteio
  const handleSortear = () => {
    if (players.length === 0) return;

    const timesGerados = sortearTimes(players);
    setTimes(timesGerados);
  };

  // 💾 Confirmar sorteio
  const handleConfirmar = async () => {
    if (!gameId) return;

    // limpar se já existir
    await supabase.from("times_sorteados").delete().eq("game_id", gameId);

    // inserir novo sorteio
    for (const time of times) {
      for (const jogador of time.jogadores) {
        await supabase.from("times_sorteados").insert({
          game_id: gameId,
          nome_time: time.nome,
          user_id: jogador.id,
        });
      }
    }

    await supabase
      .from("games")
      .update({ sorteio_confirmado: true })
      .eq("id", gameId);

    alert("Sorteio confirmado oficialmente!");
    window.location.reload();
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <ProtectedRoute>
      <div style={{ padding: 20 }}>
        <h1>Sorteio Oficial ⚽</h1>

        {!sorteioConfirmado && (
          <>
            <button onClick={handleSortear}>Gerar Sorteio</button>

            {isAdmin && times.length > 0 && (
              <button onClick={handleConfirmar} style={{ marginLeft: 10 }}>
                Confirmar Sorteio
              </button>
            )}
          </>
        )}

        {times.map((time) => (
          <div key={time.nome} style={{ marginTop: 20 }}>
            <h2>{time.nome}</h2>
            <ul>
              {time.jogadores.map((j) => (
                <li key={j.id}>
                  {j.users?.nome_completo} ({j.users?.posicao})
                </li>
              ))}
            </ul>
          </div>
        ))}

        {sorteioConfirmado && (
          <p style={{ marginTop: 20 }}>🔒 Sorteio oficial confirmado</p>
        )}
      </div>
    </ProtectedRoute>
  );
}
