import { mockEvents, mockRanking } from "../data/mockEvents";
import "./Home.css";

function Home() {
  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="badge">Padel Nation CR</span>

            <h1>La comunidad de pádel organizada en una sola plataforma.</h1>

            <p>
              Inscribite a pozos, competí por puntos, seguí tu ranking y subí
              de nivel temporada tras temporada.
            </p>

            <div className="hero-actions">
              <a className="btn btn-primary" href="#events">
                Ver próximos eventos
              </a>
              <a className="btn btn-secondary" href="#ranking">
                Ver ranking
              </a>
            </div>
          </div>

          <div className="hero-panel card">
            <div className="hero-panel-header">
              <span>Evento destacado</span>
              <strong>En vivo</strong>
            </div>

            <div className="score-card">
              <div>
                <small>Pozo Mexicano</small>
                <h3>Categoría B</h3>
              </div>
              <span className="score-category">B</span>
            </div>

            <div className="match-preview">
              <p>Ronda 2 · Cancha 1</p>
              <div className="teams">
                <span>Carlos + Diego</span>
                <strong>18</strong>
              </div>
              <div className="teams">
                <span>Andrés + Luis</span>
                <strong>16</strong>
              </div>
            </div>

            <div className="ranking-mini">
              <span>#1 Carlos Vargas</span>
              <strong>742 pts</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="events">
        <div className="container">
          <div className="section-header">
            <div>
              <p className="section-kicker">Eventos</p>
              <h2 className="section-title">Próximos pozos y retos</h2>
            </div>
            <p className="section-description">
              Los eventos se organizan por categoría principal: AA, A, B, C y
              D. Cada jugador mantiene un nivel específico dentro del ranking:
              +, normal o -.
            </p>
          </div>

          <div className="event-grid">
            {mockEvents.map((event) => (
              <article className="event-card card" key={event.id}>
                <div className="event-card-top">
                  <span className="badge">{event.format}</span>
                  <span className="event-status">{event.status}</span>
                </div>

                <h3>{event.title}</h3>

                <div className="event-meta">
                  <span>{event.date}</span>
                  <span>{event.time}</span>
                  <span>{event.location}</span>
                </div>

                <div className="event-details">
                  <div>
                    <small>Cupos</small>
                    <strong>
                      {event.playersRegistered}/{event.playerLimit}
                    </strong>
                  </div>
                  <div>
                    <small>Canchas</small>
                    <strong>{event.courts}</strong>
                  </div>
                  <div>
                    <small>Niveles</small>
                    <strong>{event.allowedLevels.join(", ")}</strong>
                  </div>
                </div>

                <button className="btn btn-primary event-button">
                  Inscribirme
                </button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section how-section" id="how-it-works">
        <div className="container">
          <div className="section-header">
            <div>
              <p className="section-kicker">Funcionamiento</p>
              <h2 className="section-title">Dos motores de juego</h2>
            </div>
          </div>

          <div className="format-grid">
            <div className="format-card card">
              <span className="badge">Mexicano</span>
              <h3>Rondas dinámicas por puntaje</h3>
              <p>
                La primera ronda se genera al azar. Luego, cada jugador suma los
                puntos obtenidos y las siguientes rondas se organizan con
                jugadores de puntaje cercano.
              </p>
            </div>

            <div className="format-card card">
              <span className="badge">Americano</span>
              <h3>Todos contra todos</h3>
              <p>
                El calendario completo se genera desde el inicio. Los jugadores
                rotan sin que el puntaje acumulado modifique los próximos
                partidos.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="ranking">
        <div className="container">
          <div className="section-header">
            <div>
              <p className="section-kicker">Ranking</p>
              <h2 className="section-title">Ranking Categoría B</h2>
            </div>
            <button className="btn btn-secondary">Ver ranking completo</button>
          </div>

          <div className="ranking-table card">
            <div className="ranking-row ranking-head">
              <span>Pos</span>
              <span>Jugador</span>
              <span>Nivel</span>
              <span>Puntos</span>
              <span>PJ</span>
              <span>PG</span>
              <span>Dif.</span>
            </div>

            {mockRanking.map((player) => (
              <div className="ranking-row" key={player.position}>
                <span>#{player.position}</span>
                <strong>{player.name}</strong>
                <span className="level-pill">{player.level}</span>
                <span>{player.points}</span>
                <span>{player.played}</span>
                <span>{player.wins}</span>
                <span>{player.difference}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      <section className="section admin-preview" id="admin">
        <div className="container admin-grid">
          <div>
            <p className="section-kicker">Panel administrativo</p>
            <h2 className="section-title">
              Crear eventos, generar rondas e ingresar resultados.
            </h2>
            <p className="section-description">
              El administrador puede crear pozos, definir formato, categoría,
              cantidad de jugadores, canchas y duración. Luego podrá ingresar
              resultados para actualizar tablas y rankings.
            </p>
          </div>

          <div className="admin-card card">
            <div className="admin-stat">
              <span>Eventos activos</span>
              <strong>4</strong>
            </div>
            <div className="admin-stat">
              <span>Jugadores registrados</span>
              <strong>126</strong>
            </div>
            <div className="admin-stat">
              <span>Resultados pendientes</span>
              <strong>8</strong>
            </div>
            <button className="btn btn-primary">Crear evento</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;