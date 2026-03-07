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
  } | null;
};

type TeamPlayerRow = {
  team_id: string;
  users:
    | {
        nome_completo: string;
        posicao: string;
      }
    | {
        nome_completo: string;
        posicao: string;
      }[]
    | null;
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

      const normalizedPlayers =
        (playersData as TeamPlayerRow[] | null)?.map((player) => ({
          team_id: player.team_id,
          users: Array.isArray(player.users) ? player.users[0] ?? null : player.users,
        })) ?? [];

      setPlayers(normalizedPlayers);

      setLoading(false);
    };

    fetchTimes();
  }, []);

  if (loading) return <p className="p-5">Carregando...</p>;

  return (
    <ProtectedRoute>
      <div className="p-5">
        <h1>Times Sorteados ⚽</h1>

        <LogoutButton />

        {teams.length === 0 && <p>Nenhum sorteio realizado ainda.</p>}

        {teams.map((team) => {
          const teamPlayers = players.filter((p) => p.team_id === team.id);

          const linha = teamPlayers.filter(
            (p) => p.users?.posicao !== "goleiro",
          );

          const goleiro = teamPlayers.find(
            (p) => p.users?.posicao === "goleiro",
          );

          return (
            <div
              key={team.id}
              className="mt-5 rounded-xl bg-neutral-100 p-4 dark:bg-slate-800"
            >
              <h2>{team.nome_time}</h2>

              {goleiro && (
                <p>
                  🥅 <strong>Goleiro:</strong> {goleiro.users?.nome_completo}
                </p>
              )}

              <ul>
                {linha.map((player) => (
                  <li key={player.users?.nome_completo}>
                    {player.users?.nome_completo}
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
