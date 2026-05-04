import { useState } from "react";
import { Link } from "react-router-dom";
import { mockEvents } from "../data/mockEvents";
import "./AdminDashboard.css";

function AdminDashboard() {
  const activeEvents = mockEvents.filter((event) => event.status !== "Cerrado");
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  const currentEvent = activeEvents[currentEventIndex];

  function goToPreviousEvent() {
    setCurrentEventIndex((currentIndex) =>
      currentIndex === 0 ? activeEvents.length - 1 : currentIndex - 1
    );
  }

  function goToNextEvent() {
    setCurrentEventIndex((currentIndex) =>
      currentIndex === activeEvents.length - 1 ? 0 : currentIndex + 1
    );
  }

  return (
    <main className="admin-page">
      <section className="section">
        <div className="container">
          <div className="admin-header">
            <div>
              <p className="section-kicker">Panel administrativo</p>
              <h1 className="section-title">Centro de control Padel Nation</h1>
              <p className="section-description">
                Creá eventos, coordiná pozos, generá rondas, ingresá resultados
                y mantené vivo el ranking competitivo.
              </p>
            </div>

            <Link className="btn btn-primary" to="/admin/crear-evento">
              Crear nuevo evento
            </Link>
          </div>

          <div className="admin-stats-grid">
            <div className="admin-stat-card card">
              <span>Eventos activos</span>
              <strong>4</strong>
              <small>Pozos, retos y torneos abiertos</small>
            </div>

            <div className="admin-stat-card card">
              <span>Jugadores registrados</span>
              <strong>126</strong>
              <small>Base competitiva actual</small>
            </div>

            <div className="admin-stat-card card">
              <span>Resultados pendientes</span>
              <strong>8</strong>
              <small>Partidos por actualizar</small>
            </div>

            <div className="admin-stat-card card">
              <span>Temporada actual</span>
              <strong>2026</strong>
              <small>Ranking activo</small>
            </div>
          </div>

          <div className="admin-layout">
            <section className="card admin-panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Eventos</p>
                  <h2>Eventos activos</h2>
                </div>
                <Link className="btn btn-secondary" to="/eventos">
                  Ver todos
                </Link>
              </div>

              {currentEvent ? (
                <div className="admin-event-carousel">
                  <article className="carousel-event-card">
                    <div className="carousel-event-top">
                      <span className="badge">{currentEvent.format}</span>
                      <span className="carousel-event-count">
                        {currentEventIndex + 1} de {activeEvents.length}
                      </span>
                    </div>

                    <h3>{currentEvent.title}</h3>

                    <div className="carousel-event-meta">
                      <span>{currentEvent.date}</span>
                      <span>{currentEvent.time}</span>
                      <span>{currentEvent.location}</span>
                    </div>

                    <div className="carousel-event-bottom">
                      <span>
                        {currentEvent.playersRegistered}/{currentEvent.playerLimit}{" "}
                        cupos · {currentEvent.courts} canchas
                      </span>

                      <Link
                        className="btn btn-primary"
                        to={`/admin/evento/${currentEvent.id}`}
                      >
                        Administrar
                      </Link>
                    </div>
                  </article>

                  <div className="carousel-controls">
                    <button
                      className="carousel-nav-btn"
                      onClick={goToPreviousEvent}
                      type="button"
                    >
                      ←
                    </button>

                    <div className="carousel-dots">
                      {activeEvents.map((event, index) => (
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
                    >
                      →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-admin-state">
                  <p>No hay eventos activos en este momento.</p>
                </div>
              )}
            </section>

            <aside className="card admin-panel">
              <p className="section-kicker">Acciones rápidas</p>
              <h2>Operación diaria</h2>

              <div className="quick-actions">
                <Link className="quick-action" to="/admin/crear-evento">
                  Crear evento
                </Link>
                <button className="quick-action">Ingresar resultados</button>
                <button className="quick-action">Gestionar jugadores</button>
                <button className="quick-action">Actualizar ranking</button>
                <button className="quick-action">Ver temporadas</button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AdminDashboard;