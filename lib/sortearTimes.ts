type Player = {
  id: string;
  nome_completo: string;
  estrelas: number;
  posicao: string;
};

export function sortearTimes(players: Player[]) {
  const goleiros = players.filter(p => p.posicao === "goleiro");
  const linha = players.filter(p => p.posicao !== "goleiro");

  linha.sort((a, b) => b.estrelas - a.estrelas);

  const times = [
    { nome: "Time Azul", jogadores: [] as Player[] },
    { nome: "Time Amarelo", jogadores: [] as Player[] },
    { nome: "Time Verde", jogadores: [] as Player[] },
    { nome: "Time Branco", jogadores: [] as Player[] },
  ];

  let index = 0;
  let direction = 1;

  linha.forEach(player => {
    times[index].jogadores.push(player);

    if (direction === 1) {
      if (index === 3) direction = -1;
      else index++;
    } else {
      if (index === 0) direction = 1;
      else index--;
    }
  });

  goleiros.forEach((goleiro, i) => {
    const timeIndex = i % 4;
    times[timeIndex].jogadores.push(goleiro);
  });

  return times;
}
