import { useState } from "react";
import { Link } from "react-router-dom";
import { useEvents } from "../hooks/useEvents";
import { useRanking } from "../hooks/useRanking";
import {
  FORMAT_LABELS,
  STATUS_LABELS,
  formatEventDate,
  formatEventTime,
} from "../utils/formatters";
import "./Home.css";

function Home() {
  const { events, loading: eventsLoading } = useEvents({
    excludeStatuses: ["draft", "cancelled"],
  });
  const { ranking, loading: rankingLoading } = useRanking({});

  const featuredEvents = events.slice(0, 5);
  const topRanking     = ranking.slice(0, 5);

  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  const safeIndex    = featuredEvents.length > 0
    ? Math.min(currentEventIndex, featuredEvents.length - 1)
    : 0;
  const currentEvent = featuredEvents[safeIndex] ?? null;

  function goToPrev() {
    setCurrentEventIndex((i) => (i === 0 ? Math.max(featuredEvents.length - 1, 0) : i - 1));
  }
  function goToNext() {
    setCurrentEventIndex((i) => (i >= featuredEvents.length - 1 ? 0 : i + 1));
  }

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────── */}
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
              <span>Plataforma</span>
              <strong>Temporada 2026</strong>
            </div>

            <div className="score-card">
              <div>
                <small>Pozos y retos</small>
                <h3>Ranking en vivo</h3>
              </div>
              <span className="score-category">CR</span>
            </div>

            {rankingLoading ? (
              <div className="ranking-mini">
                <span>Cargando ranking…</span>
              </div>
            ) : topRanking[0] ? (
              <div className="ranking-mini">
                <span>#1 {topRanking[0].full_name}</span>
                <strong>{topRanking[0].total_points} pts</strong>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── Carrusel de próximos eventos ─────────────────────── */}
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

          {eventsLoading ? (
            <div className="empty-state card"><p>Cargando eventos…</p></div>
          ) : currentEvent ? (
            <div className="home-event-carousel card">
              <article className="home-event-slide">
                <div className="home-event-main">
                  <div className="event-card-top">
                    <span className="badge">
                      {FORMAT_LABELS[currentEvent.format] ?? currentEvent.format}
                    </span>
                    <span className="event-status">
                      {STATUS_LABELS[currentEvent.status] ?? currentEvent.status}
                    </span>
                  </div>

                  <h3>{currentEvent.title}</h3>

                  <div className="event-meta">
                    <span>{formatEventDate(currentEvent.starts_at)}</span>
                    <span>{formatEventTime(currentEvent.starts_at)}</span>
                    {currentEvent.location && <span>{currentEvent.location}</span>}
                  </div>

                  <div className="event-details">
                    <div>
                      <small>Cupos</small>
                      <strong>
                        {currentEvent.players_registered}/{currentEvent.player_limit}
                      </strong>
                    </div>

                    {currentEvent.courts && (
                      <div>
                        <small>Canchas</small>
                        <strong>{currentEvent.courts}</strong>
                      </div>
                    )}

                    {currentEvent.allowed_levels?.length > 0 && (
                      <div>
                        <small>Niveles</small>
                        <strong>{currentEvent.allowed_levels.join(", ")}</strong>
                      </div>
                    )}
                  </div>

                  <div className="home-event-actions">
                    <Link className="btn btn-primary" to="/eventos">
                      Inscribirme
                    </Link>
                    <Link className="btn btn-secondary" to="/eventos">
                      Ver detalles
                    </Link>
                  </div>
                </div>

                <div className="home-event-category">
                  <span>Categoría</span>
                  <strong>{currentEvent.category_code}</strong>
                  <small>
                    {safeIndex + 1} de {featuredEvents.length}
                  </small>
                </div>
              </article>

              {featuredEvents.length > 1 && (
                <div className="home-carousel-controls">
                  <button
                    className="carousel-nav-btn"
                    onClick={goToPrev}
                    type="button"
                    aria-label="Evento anterior"
                  >
                    ←
                  </button>

                  <div className="carousel-dots">
                    {featuredEvents.map((_, index) => (
                      <button
                        key={index}
                        className={index === safeIndex ? "carousel-dot active" : "carousel-dot"}
                        onClick={() => setCurrentEventIndex(index)}
                        type="button"
                        aria-label={`Ir al evento ${index + 1}`}
                      />
                    ))}
                  </div>

                  <button
                    className="carousel-nav-btn"
                    onClick={goToNext}
                    type="button"
                    aria-label="Siguiente evento"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state card">
              <p>No hay eventos próximos en este momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Formatos ─────────────────────────────────────────── */}
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

      {/* ── Ranking preview ───────────────────────────────────── */}
      <section className="section" id="ranking">
        <div className="container">
          <div className="section-header">
            <div>
              <p className="section-kicker">Ranking</p>
              <h2 className="section-title">Top 5 temporada 2026</h2>
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
              <span>Eventos</span>
            </div>

            {rankingLoading ? (
              <div className="ranking-row">
                <span colSpan="5" style={{ color: "var(--color-text-muted)" }}>
                  Cargando…
                </span>
              </div>
            ) : topRanking.length === 0 ? (
              <div className="ranking-row">
                <span style={{ color: "var(--color-text-muted)", gridColumn: "1 / -1" }}>
                  Aún no hay jugadores en el ranking.
                </span>
              </div>
            ) : (
              topRanking.map((player, index) => (
                <div className="ranking-row" key={player.player_id}>
                  <span>#{index + 1}</span>
                  <strong>{player.full_name}</strong>
                  <span className="level-pill">{player.level_code ?? "—"}</span>
                  <span>{player.total_points}</span>
                  <span>{player.events_counted}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Admin preview ─────────────────────────────────────── */}
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
              <strong>{eventsLoading ? "…" : events.filter(e => e.status === "open" || e.status === "almost_full").length}</strong>
            </div>
            <div className="admin-stat">
              <span>Jugadores en ranking</span>
              <strong>{rankingLoading ? "…" : ranking.length}</strong>
            </div>
            <div className="admin-stat">
              <span>Temporada</span>
              <strong>2026</strong>
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
