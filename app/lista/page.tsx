"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import LogoutButton from "@/components/LogoutButton";
import { supabase } from "@/lib/supabaseClient";

const LIMITE_JOGADORES = 20;

type Game = {
  id: string;
  data_jogo: string;
  status_lista: string;
};

type Player = {
  id: string;
  status: "confirmado" | "espera";
  ordem_entrada: number;
  users: {
    nome_completo: string;
  } | null;
};

type MyEntry = {
  id: string;
  status: "confirmado" | "espera";
};

export default function ListaPage() {
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myEntry, setMyEntry] = useState<MyEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: gamesData } = await supabase
        .from("games")
        .select("*")
        .order("data_jogo", { ascending: false })
        .limit(1);

      if (!gamesData || gamesData.length === 0) {
        setGame(null);
        setPlayers([]);
        setMyEntry(null);
        setLoading(false);
        return;
      }

      const currentGame = gamesData[0];
      setGame(currentGame);

      const { data: playersData } = await supabase
        .from("game_players")
        .select(
          `
    id,
    status,
    ordem_entrada,
    user_id,
    users!game_players_user_id_fkey (
      nome_completo
    )
  `,
        )
        .eq("game_id", currentGame.id)
        .order("ordem_entrada", { ascending: true });

      setPlayers(playersData || []);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: entry } = await supabase
          .from("game_players")
          .select("id, status")
          .eq("game_id", currentGame.id)
          .eq("user_id", user.id)
          .maybeSingle();

        setMyEntry(entry || null);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  // 🔥 Separação entre confirmados e espera
  const confirmadosList = players.filter((p) => p.status === "confirmado");

  const esperaList = players.filter((p) => p.status === "espera");

  const totalConfirmados = confirmadosList.length;
  const totalEspera = esperaList.length;

  const vagasRestantes = LIMITE_JOGADORES - totalConfirmados;

  // 🔐 ENTRAR NA LISTA
  const handleJoin = async () => {
    if (!game) return;

    setActionLoading(true);

    const { error } = await supabase.rpc("entrar_na_lista", {
      p_game_id: game.id,
    });

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      window.location.reload();
    }

    setActionLoading(false);
  };

  // 🔐 SAIR DA LISTA
  const handleLeave = async () => {
    if (!game) return;

    setActionLoading(true);

    const { error } = await supabase.rpc("sair_da_lista", {
      p_game_id: game.id,
    });

    if (error) {
      console.error(error);
      alert(error.message);
    } else {
      window.location.reload();
    }

    setActionLoading(false);
  };

  return (
    <ProtectedRoute>
      <div style={{ padding: 20 }}>
        <h1>Lista do Futebol ⚽</h1>

        <LogoutButton />

        {loading && <p>Carregando...</p>}

        {!loading && !game && <p>Nenhum futebol cadastrado.</p>}

        {!loading && game && (
          <>
            <p>
              <strong>Data:</strong>{" "}
              {game.data_jogo.split("-").reverse().join("/")}
            </p>

            <p>
              <strong>Status da lista:</strong> {game.status_lista}
            </p>

            <p>
              <strong>Vagas restantes:</strong>{" "}
              {vagasRestantes > 0 ? vagasRestantes : "Lista cheia"}
            </p>

            {myEntry && (
              <p>
                <strong>Seu status:</strong>{" "}
                {myEntry.status === "confirmado"
                  ? "Confirmado ✅"
                  : "Lista de espera ⏳"}
              </p>
            )}

            {!myEntry && (
              <button onClick={handleJoin} disabled={actionLoading}>
                Entrar na lista
              </button>
            )}

            {myEntry && (
              <button
                onClick={handleLeave}
                disabled={actionLoading}
                style={{ marginTop: 10 }}
              >
                Sair da lista
              </button>
            )}

            {/* 🔥 BLOCO ATUALIZADO CONFORME SOLICITADO */}

            <h2>Confirmados ({totalConfirmados})</h2>

            {confirmadosList.length === 0 && <p>Nenhum confirmado ainda.</p>}

            <ul>
              {confirmadosList.map((player, index) => (
                <li key={player.id}>
                  #{index + 1} - {player.users?.nome_completo}
                </li>
              ))}
            </ul>

            {esperaList.length > 0 && (
              <>
                <h2>Lista de Espera ({totalEspera})</h2>

                <ul>
                  {esperaList.map((player, index) => (
                    <li key={player.id}>
                      #{totalConfirmados + index + 1} -{" "}
                      {player.users?.nome_completo}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
