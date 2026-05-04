import { useState } from "react";
import { Link } from "react-router-dom";
import { mockEvents, mockRanking } from "../data/mockEvents";
import "./Home.css";

function Home() {
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  const featuredEvents = mockEvents.slice(0, 5);
  const currentEvent = featuredEvents[currentEventIndex];

  function goToPreviousEvent() {
    setCurrentEventIndex((currentIndex) =>
      currentIndex === 0 ? featuredEvents.length - 1 : currentIndex - 1
    );
  }

  function goToNextEvent() {
    setCurrentEventIndex((currentIndex) =>
      currentIndex === featuredEvents.length - 1 ? 0 : currentIndex + 1
    );
  }

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
              <Link className="btn btn-primary" to="/eventos">
                Ver próximos eventos
              </Link>
              <Link className="btn btn-secondary" to="/ranking">
                Ver ranking
              </Link>
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

            <div className="section-actions">
              <p className="section-description">
                Una vista rápida de los próximos eventos. La lista completa vive
                en la sección de Eventos.
              </p>

              <Link className="btn btn-secondary" to="/eventos">
                Ver todos
              </Link>
            </div>
          </div>

          {currentEvent && (
            <div className="home-event-carousel card">
              <article className="home-event-slide">
                <div className="home-event-main">
                  <div className="event-card-top">
                    <span className="badge">{currentEvent.format}</span>
                    <span className="event-status">{currentEvent.status}</span>
                  </div>

                  <h3>{currentEvent.title}</h3>

                  <div className="event-meta">
                    <span>{currentEvent.date}</span>
                    <span>{currentEvent.time}</span>
                    <span>{currentEvent.location}</span>
                  </div>

                  <div className="event-details">
                    <div>
                      <small>Cupos</small>
                      <strong>
                        {currentEvent.playersRegistered}/
                        {currentEvent.playerLimit}
                      </strong>
                    </div>

                    <div>
                      <small>Canchas</small>
                      <strong>{currentEvent.courts}</strong>
                    </div>

                    <div>
                      <small>Niveles</small>
                      <strong>{currentEvent.allowedLevels.join(", ")}</strong>
                    </div>
                  </div>

                  <div className="home-event-actions">
                    <button className="btn btn-primary">Inscribirme</button>
                    <Link className="btn btn-secondary" to="/eventos">
                      Ver detalles
                    </Link>
                  </div>
                </div>

                <div className="home-event-category">
                  <span>Categoría</span>
                  <strong>{currentEvent.category}</strong>
                  <small>
                    {currentEventIndex + 1} de {featuredEvents.length}
                  </small>
                </div>
              </article>

              <div className="home-carousel-controls">
                <button
                  className="carousel-nav-btn"
                  onClick={goToPreviousEvent}
                  type="button"
                  aria-label="Evento anterior"
                >
                  ←
                </button>

                <div className="carousel-dots">
                  {featuredEvents.map((event, index) => (
                    <button
                      key={event.id}
                      className={
                        index === currentEventIndex
                          ? "carousel-dot active"
                          : "carousel-dot"
                      }
                      onClick={() => setCurrentEventIndex(index)}
                      type="button"
                      aria-label={`Ir al evento ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  className="carousel-nav-btn"
                  onClick={goToNextEvent}
                  type="button"
                  aria-label="Siguiente evento"
                >
                  →
                </button>
              </div>
            </div>
          )}
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

            <Link className="btn btn-secondary" to="/ranking">
              Ver ranking completo
            </Link>
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
            <Link className="btn btn-primary" to="/admin">
              Ir al panel admin
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;