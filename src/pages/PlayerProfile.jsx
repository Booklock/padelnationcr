import "./PlayerProfile.css";

const player = {
  name: "Carlos Vargas",
  email: "carlos@email.com",
  category: "B",
  level: "B+",
  rankingPosition: 2,
  seasonPoints: 742,
  nextLevel: "A-",
  pointsToNextLevel: 158,
  played: 18,
  wins: 12,
  losses: 6,
  pointsFor: 375,
  pointsAgainst: 337,
  winRate: 67,
};

const upcomingEvents = [
  {
    id: 1,
    title: "Pozo Mexicano Categoría B",
    date: "Lunes 6 de mayo",
    time: "7:00 p.m.",
    location: "Padel Club Escazú",
    status: "Confirmado",
  },
  {
    id: 2,
    title: "Americano Categoría B",
    date: "Jueves 9 de mayo",
    time: "8:00 p.m.",
    location: "Santa Ana Padel",
    status: "Pendiente",
  },
];

const recentHistory = [
  {
    id: 1,
    event: "Pozo Mexicano Categoría B",
    result: "2 victorias / 1 derrota",
    points: "+58 pts",
    date: "28 abril",
  },
  {
    id: 2,
    event: "Reto Categoría B",
    result: "Victoria",
    points: "+32 pts",
    date: "24 abril",
  },
  {
    id: 3,
    event: "Americano Categoría B",
    result: "3 victorias / 2 derrotas",
    points: "+44 pts",
    date: "20 abril",
  },
];

function PlayerProfile() {
  const difference = player.pointsFor - player.pointsAgainst;
  const progressToNextLevel = Math.round(
    (player.seasonPoints / (player.seasonPoints + player.pointsToNextLevel)) *
      100
  );

  return (
    <main className="section profile-page">
      <div className="container">
        <section className="profile-hero card">
          <div className="profile-identity">
            <div className="profile-avatar">
              {getInitials(player.name)}
            </div>

            <div>
              <p className="section-kicker">Mi perfil</p>
              <h1 className="section-title">{player.name}</h1>
              <p className="section-description">
                Seguí tu rendimiento, próximos eventos, historial competitivo y
                progreso hacia el siguiente nivel.
              </p>
            </div>
          </div>

          <div className="profile-level-card">
            <span>Nivel actual</span>
            <strong>{player.level}</strong>
            <small>Categoría {player.category}</small>
          </div>
        </section>

        <section className="profile-stats-grid">
          <div className="profile-stat-card card">
            <span>Puntos temporada</span>
            <strong>{player.seasonPoints}</strong>
            <small>Ranking #{player.rankingPosition}</small>
          </div>

          <div className="profile-stat-card card">
            <span>Partidos jugados</span>
            <strong>{player.played}</strong>
            <small>{player.wins} victorias</small>
          </div>

          <div className="profile-stat-card card">
            <span>Win rate</span>
            <strong>{player.winRate}%</strong>
            <small>{player.wins}G / {player.losses}P</small>
          </div>

          <div className="profile-stat-card card">
            <span>Diferencia</span>
            <strong>
              {difference >= 0 ? "+" : ""}
              {difference}
            </strong>
            <small>Puntos a favor vs contra</small>
          </div>
        </section>

        <section className="profile-main-grid">
          <div className="profile-left-column">
            <article className="card profile-panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Progreso</p>
                  <h2>Camino hacia {player.nextLevel}</h2>
                </div>
              </div>

              <p className="profile-panel-description">
                Estás a {player.pointsToNextLevel} puntos de ser candidato para
                subir a nivel {player.nextLevel}. Los ascensos pueden quedar
                sujetos a revisión administrativa.
              </p>

              <div className="profile-progress">
                <div className="profile-progress-top">
                  <span>{player.seasonPoints} pts</span>
                  <strong>{progressToNextLevel}%</strong>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{ width: `${progressToNextLevel}%` }}
                  />
                </div>

                <div className="profile-progress-bottom">
                  <span>{player.level}</span>
                  <span>{player.nextLevel}</span>
                </div>
              </div>
            </article>

            <article className="card profile-panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Historial</p>
                  <h2>Actividad reciente</h2>
                </div>
              </div>

              <div className="history-list">
                {recentHistory.map((item) => (
                  <div className="history-item" key={item.id}>
                    <div>
                      <strong>{item.event}</strong>
                      <small>
                        {item.date} · {item.result}
                      </small>
                    </div>

                    <span>{item.points}</span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="profile-right-column">
            <article className="card profile-panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Agenda</p>
                  <h2>Próximos eventos</h2>
                </div>
              </div>

              <div className="profile-events-list">
                {upcomingEvents.map((event) => (
                  <div className="profile-event-card" key={event.id}>
                    <span className="badge">{event.status}</span>
                    <h3>{event.title}</h3>
                    <p>
                      {event.date} · {event.time}
                    </p>
                    <small>{event.location}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="card profile-panel premium-preview">
              <span className="badge">Futuro Premium</span>
              <h2>Estadísticas avanzadas</h2>
              <p>
                En una fase futura, los jugadores premium podrán ver análisis
                avanzado, tendencias de rendimiento, historial completo y
                prioridad de inscripción.
              </p>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

function getInitials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default PlayerProfile;