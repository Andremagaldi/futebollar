"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import LogoutButton from "@/components/LogoutButton";
import { supabase } from "@/lib/supabaseClient";

type Team = {
  id: string;
  nome_time: string;
};

type TeamPlayer = {
  team_id: string;
  users: {
    nome_completo: string;
    posicao: string;
  };
};

export default function TimesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimes = async () => {
      // Buscar último jogo
      const { data: gameData } = await supabase
        .from("games")
        .select("id")
        .order("data_jogo", { ascending: false })
        .limit(1)
        .single();

      if (!gameData) {
        setLoading(false);
        return;
      }

      // Buscar times
      const { data: teamsData } = await supabase
        .from("game_teams")
        .select("*")
        .eq("game_id", gameData.id);

      setTeams(teamsData || []);

      // Buscar jogadores dos times
      const { data: playersData } = await supabase
        .from("team_players")
        .select(
          `
          team_id,
          users (
            nome_completo,
            posicao
          )
        `,
        )
        .in("team_id", teamsData?.map((t) => t.id) || []);

      setPlayers(playersData || []);

      setLoading(false);
    };

    fetchTimes();
  }, []);

  if (loading) return <p style={{ padding: 20 }}>Carregando...</p>;

  return (
    <ProtectedRoute>
      <div style={{ padding: 20 }}>
        <h1>Times Sorteados ⚽</h1>

        <LogoutButton />

        {teams.length === 0 && <p>Nenhum sorteio realizado ainda.</p>}

        {teams.map((team) => {
          const teamPlayers = players.filter((p) => p.team_id === team.id);

          const linha = teamPlayers.filter(
            (p) => p.users.posicao !== "goleiro",
          );

          const goleiro = teamPlayers.find(
            (p) => p.users.posicao === "goleiro",
          );

          return (
            <div
              key={team.id}
              style={{
                marginTop: 20,
                padding: 15,
                borderRadius: 12,
                background: "#f3f3f3",
              }}
            >
              <h2>{team.nome_time}</h2>

              {goleiro && (
                <p>
                  🥅 <strong>Goleiro:</strong> {goleiro.users.nome_completo}
                </p>
              )}

              <ul>
                {linha.map((player) => (
                  <li key={player.users.nome_completo}>
                    {player.users.nome_completo}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </ProtectedRoute>
  );
}
