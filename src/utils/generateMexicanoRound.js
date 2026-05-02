export function generateMexicanoRound(players, roundNumber = 1) {
  if (!players || players.length < 4) {
    return [];
  }

  const orderedPlayers =
    roundNumber === 1
      ? shufflePlayers(players)
      : [...players].sort((a, b) => b.eventPoints - a.eventPoints);

  const matches = [];

  for (let i = 0; i < orderedPlayers.length; i += 4) {
    const group = orderedPlayers.slice(i, i + 4);

    if (group.length < 4) {
      continue;
    }

    matches.push({
      id: `${roundNumber}-${i}`,
      roundNumber,
      courtNumber: matches.length + 1,
      teamA: [group[0], group[3]],
      teamB: [group[1], group[2]],
      teamAScore: "",
      teamBScore: "",
      status: "Pendiente",
    });
  }

  return matches;
}

function shufflePlayers(players) {
  return [...players].sort(() => Math.random() - 0.5);
}