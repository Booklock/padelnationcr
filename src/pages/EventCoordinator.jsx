import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { mockEvents } from "../data/mockEvents";
import { mockPlayers } from "../data/mockPlayers";
import { generateMexicanoRound } from "../utils/generateMexicanoRound";
import "./EventCoordinator.css";

function EventCoordinator() {
  const { id } = useParams();

  const event =
    mockEvents.find((currentEvent) => currentEvent.id === Number(id)) ||
    mockEvents[0];

  const initialPlayers = mockPlayers.map((player) => ({
    ...player,
    eventPoints: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  }));

  const [currentRound, setCurrentRound] = useState(1);
  const [players, setPlayers] = useState(initialPlayers);
  const [matchHistory, setMatchHistory] = useState([]);

  const [matches, setMatches] = useState(() =>
    generateMexicanoRound(initialPlayers, 1)
  );

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.eventPoints !== a.eventPoints) {
        return b.eventPoints - a.eventPoints;
      }

      const diffA = a.pointsFor - a.pointsAgainst;
      const diffB = b.pointsFor - b.pointsAgainst;

      return diffB - diffA;
    });
  }, [players]);

  function recalculatePlayersFromMatches(savedMatches) {
    const cleanPlayers = mockPlayers.map((player) => ({
      ...player,
      eventPoints: 0,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    }));

    return cleanPlayers.map((player) => {
      let updatedPlayer = { ...player };

      savedMatches.forEach((match) => {
        if (!match.isSaved) return;

        const teamAScore = Number(match.teamAScore);
        const teamBScore = Number(match.teamBScore);

        const isTeamA = match.teamA.some(
          (teamPlayer) => teamPlayer.id === player.id
        );

        const isTeamB = match.teamB.some(
          (teamPlayer) => teamPlayer.id === player.id
        );

        if (!isTeamA && !isTeamB) return;

        const playerScore = isTeamA ? teamAScore : teamBScore;
        const opponentScore = isTeamA ? teamBScore : teamAScore;
        const won = playerScore > opponentScore;

        updatedPlayer = {
          ...updatedPlayer,
          eventPoints: updatedPlayer.eventPoints + playerScore,
          matchesPlayed: updatedPlayer.matchesPlayed + 1,
          wins: updatedPlayer.wins + (won ? 1 : 0),
          losses: updatedPlayer.losses + (won ? 0 : 1),
          pointsFor: updatedPlayer.pointsFor + playerScore,
          pointsAgainst: updatedPlayer.pointsAgainst + opponentScore,
        };
      });

      return updatedPlayer;
    });
  }

  function handleScoreChange(matchId, field, value) {
    setMatches((currentMatches) =>
      currentMatches.map((match) =>
        match.id === matchId
          ? {
              ...match,
              [field]: value,
            }
          : match
      )
    );
  }

  function handleSaveResult(matchId) {
    const matchToSave = matches.find((match) => match.id === matchId);

    if (!matchToSave) return;

    const teamAScore = Number(matchToSave.teamAScore);
    const teamBScore = Number(matchToSave.teamBScore);

    if (
      matchToSave.teamAScore === "" ||
      matchToSave.teamBScore === "" ||
      Number.isNaN(teamAScore) ||
      Number.isNaN(teamBScore)
    ) {
      alert("Ingresá ambos resultados antes de guardar.");
      return;
    }

    if (teamAScore === teamBScore) {
      alert("Por ahora no estamos permitiendo empates en el mockup.");
      return;
    }

    const savedMatch = {
      ...matchToSave,
      teamAScore,
      teamBScore,
      status: "Finalizado",
      isSaved: true,
      isEditing: false,
    };

    const updatedMatches = matches.map((match) =>
      match.id === matchId ? savedMatch : match
    );

    const updatedHistoryWithoutCurrentMatch = matchHistory.filter(
      (match) => match.id !== matchId
    );

    const updatedHistory = [...updatedHistoryWithoutCurrentMatch, savedMatch];

    setMatches(updatedMatches);
    setMatchHistory(updatedHistory);
    setPlayers(recalculatePlayersFromMatches(updatedHistory));
  }

  function handleEditResult(matchId) {
    const updatedMatches = matches.map((match) =>
      match.id === matchId
        ? {
            ...match,
            status: "Editando",
            isSaved: false,
            isEditing: true,
          }
        : match
    );

    const updatedHistory = matchHistory.filter((match) => match.id !== matchId);

    setMatches(updatedMatches);
    setMatchHistory(updatedHistory);
    setPlayers(recalculatePlayersFromMatches(updatedHistory));
  }

  function handleGenerateNextRound() {
    const hasPendingResults = matches.some((match) => !match.isSaved);

    if (hasPendingResults) {
      alert("Guardá todos los resultados antes de generar la siguiente ronda.");
      return;
    }

    const nextRound = currentRound + 1;
    const nextMatches = generateMexicanoRound(sortedPlayers, nextRound);

    setCurrentRound(nextRound);
    setMatches(nextMatches);
  }

  return (
    <main className="section coordinator-page">
      <div className="container">
        <Link className="back-link" to="/admin">
          ← Volver al admin
        </Link>

        <div className="coordinator-header">
          <div>
            <p className="section-kicker">Coordinador de evento</p>
            <h1 className="section-title">{event.title}</h1>
            <p className="section-description">
              {event.format === "Mexicano"
                ? "En mexicano, la primera ronda es aleatoria. Luego las rondas se generan según el puntaje acumulado."
                : "En americano, las rondas se generan como todos contra todos sin reorganizar por puntos."}
            </p>
          </div>

          <div className="event-summary card">
            <span className="badge">{event.format}</span>
            <strong>Categoría {event.category}</strong>
            <small>{event.location}</small>
            <small>
              {event.playersRegistered}/{event.playerLimit} jugadores ·{" "}
              {event.courts} canchas
            </small>
          </div>
        </div>

        <div className="coordinator-grid">
          <section className="card coordinator-panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Ronda actual</p>
                <h2>Ronda {currentRound}</h2>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleGenerateNextRound}
              >
                Generar siguiente ronda
              </button>
            </div>

            <div className="round-note">
              {currentRound === 1
                ? "Primera ronda generada al azar."
                : "Ronda generada según puntaje acumulado."}
            </div>

            <div className="match-list">
              {matches.map((match) => (
                <article
                  className={`match-card ${match.isSaved ? "match-saved" : ""}`}
                  key={match.id}
                >
                  <div className="match-top">
                    <span>Cancha {match.courtNumber}</span>
                    <strong>{match.status}</strong>
                  </div>

                  <div className="match-teams">
                    <div className="team-row">
                      <div>
                        <strong>
                          {match.teamA[0].name} + {match.teamA[1].name}
                        </strong>
                        <small>
                          {match.teamA[0].level} / {match.teamA[1].level}
                        </small>
                      </div>

                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={match.teamAScore}
                        disabled={match.isSaved}
                        onChange={(event) =>
                          handleScoreChange(
                            match.id,
                            "teamAScore",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="versus">vs</div>

                    <div className="team-row">
                      <div>
                        <strong>
                          {match.teamB[0].name} + {match.teamB[1].name}
                        </strong>
                        <small>
                          {match.teamB[0].level} / {match.teamB[1].level}
                        </small>
                      </div>

                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={match.teamBScore}
                        disabled={match.isSaved}
                        onChange={(event) =>
                          handleScoreChange(
                            match.id,
                            "teamBScore",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="match-actions">
                    {match.isSaved ? (
                      <button
                        className="btn btn-secondary match-save"
                        onClick={() => handleEditResult(match.id)}
                      >
                        Editar resultado
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary match-save"
                        onClick={() => handleSaveResult(match.id)}
                      >
                        {match.isEditing
                          ? "Guardar corrección"
                          : "Guardar resultado"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <aside className="card coordinator-panel">
            <p className="section-kicker">Tabla del evento</p>
            <h2>Ranking interno</h2>

            <div className="event-ranking-list">
              {sortedPlayers.map((player, index) => {
                const difference = player.pointsFor - player.pointsAgainst;

                return (
                  <div className="event-ranking-row" key={player.id}>
                    <span>#{index + 1}</span>

                    <div>
                      <strong>{player.name}</strong>
                      <small>
                        {player.level} · PJ {player.matchesPlayed} · PG{" "}
                        {player.wins}
                      </small>
                    </div>

                    <div className="ranking-points">
                      <strong>{player.eventPoints} pts</strong>
                      <small>
                        Dif. {difference >= 0 ? "+" : ""}
                        {difference}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default EventCoordinator;