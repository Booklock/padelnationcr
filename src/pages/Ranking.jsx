import { useMemo, useState } from "react";
import "./Ranking.css";

const categories = ["Todos", "AA", "A", "B", "C", "D"];

const rankingPlayers = [
  {
    id: 1,
    position: 1,
    name: "Sebastián Alvarado",
    category: "AA",
    level: "AA",
    points: 980,
    played: 24,
    wins: 19,
    losses: 5,
    pointsFor: 498,
    pointsAgainst: 386,
  },
  {
    id: 2,
    position: 2,
    name: "Carlos Vargas",
    category: "B",
    level: "B+",
    points: 742,
    played: 18,
    wins: 12,
    losses: 6,
    pointsFor: 375,
    pointsAgainst: 337,
  },
  {
    id: 3,
    position: 3,
    name: "Andrés Mora",
    category: "B",
    level: "B+",
    points: 710,
    played: 16,
    wins: 11,
    losses: 5,
    pointsFor: 342,
    pointsAgainst: 311,
  },
  {
    id: 4,
    position: 4,
    name: "María Fernanda Soto",
    category: "A",
    level: "A+",
    points: 695,
    played: 17,
    wins: 12,
    losses: 5,
    pointsFor: 348,
    pointsAgainst: 312,
  },
  {
    id: 5,
    position: 5,
    name: "Luis Rojas",
    category: "B",
    level: "B",
    points: 650,
    played: 15,
    wins: 9,
    losses: 6,
    pointsFor: 319,
    pointsAgainst: 298,
  },
  {
    id: 6,
    position: 6,
    name: "Daniela Quesada",
    category: "A",
    level: "A",
    points: 632,
    played: 15,
    wins: 10,
    losses: 5,
    pointsFor: 305,
    pointsAgainst: 286,
  },
  {
    id: 7,
    position: 7,
    name: "Diego Solano",
    category: "B",
    level: "B-",
    points: 520,
    played: 14,
    wins: 7,
    losses: 7,
    pointsFor: 260,
    pointsAgainst: 256,
  },
  {
    id: 8,
    position: 8,
    name: "Paola Ramírez",
    category: "C",
    level: "C+",
    points: 488,
    played: 13,
    wins: 8,
    losses: 5,
    pointsFor: 242,
    pointsAgainst: 225,
  },
  {
    id: 9,
    position: 9,
    name: "José Ramírez",
    category: "C",
    level: "C",
    points: 430,
    played: 12,
    wins: 6,
    losses: 6,
    pointsFor: 218,
    pointsAgainst: 215,
  },
  {
    id: 10,
    position: 10,
    name: "Adrián Campos",
    category: "D",
    level: "D+",
    points: 390,
    played: 11,
    wins: 6,
    losses: 5,
    pointsFor: 202,
    pointsAgainst: 190,
  },
  {
    id: 11,
    position: 11,
    name: "Sofía Calderón",
    category: "D",
    level: "D",
    points: 310,
    played: 9,
    wins: 4,
    losses: 5,
    pointsFor: 155,
    pointsAgainst: 160,
  },
];

function Ranking() {
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const filteredRanking = useMemo(() => {
    const filteredPlayers = rankingPlayers.filter((player) => {
      return selectedCategory === "Todos" || player.category === selectedCategory;
    });

    return [...filteredPlayers].sort((a, b) => b.points - a.points);
  }, [selectedCategory]);

  const topThree = filteredRanking.slice(0, 3);

  const totalPlayers = filteredRanking.length;

  const totalMatches = filteredRanking.reduce(
    (total, player) => total + player.played,
    0
  );

  const averagePoints =
    totalPlayers > 0
      ? Math.round(
          filteredRanking.reduce((total, player) => total + player.points, 0) /
            totalPlayers
        )
      : 0;

  return (
    <main className="section ranking-page">
      <div className="container">
        <section className="ranking-hero card">
          <div>
            <p className="section-kicker">Ranking</p>
            <h1 className="section-title">Temporada Padel Nation 2026</h1>
            <p className="section-description">
              Consultá el rendimiento de los jugadores por categoría, nivel,
              puntos acumulados y diferencia de puntos durante la temporada.
            </p>
          </div>

          <div className="ranking-season-card">
            <span>Temporada activa</span>
            <strong>2026</strong>
            <small>Ranking actualizado por eventos</small>
          </div>
        </section>

        <section className="ranking-summary-grid">
          <div className="ranking-summary-card card">
            <span>Jugadores</span>
            <strong>{totalPlayers}</strong>
            <small>En esta vista</small>
          </div>

          <div className="ranking-summary-card card">
            <span>Partidos jugados</span>
            <strong>{totalMatches}</strong>
            <small>Total acumulado</small>
          </div>

          <div className="ranking-summary-card card">
            <span>Promedio puntos</span>
            <strong>{averagePoints}</strong>
            <small>Por jugador</small>
          </div>
        </section>

        <section className="ranking-filters card">
          <div>
            <h2>Categoría</h2>
            <div className="filter-list">
              {categories.map((category) => (
                <button
                  key={category}
                  className={
                    selectedCategory === category
                      ? "filter-pill active"
                      : "filter-pill"
                  }
                  onClick={() => setSelectedCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="ranking-podium-section">
          <div className="section-header">
            <div>
              <p className="section-kicker">Top jugadores</p>
              <h2 className="section-title">
                {selectedCategory === "Todos"
                  ? "Top 3 global"
                  : `Top 3 categoría ${selectedCategory}`}
              </h2>
            </div>
          </div>

          {topThree.length > 0 ? (
            <div className="podium-grid">
              {topThree.map((player, index) => (
                <article className="podium-card card" key={player.id}>
                  <div className="podium-position">#{index + 1}</div>
                  <span className="level-pill">{player.level}</span>
                  <h3>{player.name}</h3>
                  <strong>{player.points} pts</strong>
                  <small>
                    {player.wins} victorias · {player.played} partidos
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state card">
              <h3>No hay jugadores en esta categoría.</h3>
              <p>Probá seleccionando otra categoría.</p>
            </div>
          )}
        </section>

        <section className="ranking-table-section">
          <div className="section-header">
            <div>
              <p className="section-kicker">Tabla completa</p>
              <h2 className="section-title">Ranking detallado</h2>
            </div>
          </div>

          <div className="ranking-full-table card">
            <div className="ranking-full-row ranking-full-head">
              <span>Pos</span>
              <span>Jugador</span>
              <span>Categoría</span>
              <span>Nivel</span>
              <span>Puntos</span>
              <span>PJ</span>
              <span>PG</span>
              <span>PP</span>
              <span>Dif.</span>
            </div>

            {filteredRanking.map((player, index) => {
              const difference = player.pointsFor - player.pointsAgainst;
              const winRate =
                player.played > 0
                  ? Math.round((player.wins / player.played) * 100)
                  : 0;

              return (
                <div className="ranking-full-row" key={player.id}>
                  <span>#{index + 1}</span>

                  <div className="ranking-player-cell">
                    <strong>{player.name}</strong>
                    <small>{winRate}% win rate</small>
                  </div>

                  <span>{player.category}</span>
                  <span className="level-pill">{player.level}</span>
                  <strong>{player.points}</strong>
                  <span>{player.played}</span>
                  <span>{player.wins}</span>
                  <span>{player.losses}</span>
                  <span>
                    {difference >= 0 ? "+" : ""}
                    {difference}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}

export default Ranking;