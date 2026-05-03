import { useMemo, useState } from "react";
import { mockEvents } from "../data/mockEvents";
import "./Events.css";

const categories = ["Todos", "AA", "A", "B", "C", "D"];
const formats = ["Todos", "Mexicano", "Americano", "Reto", "Torneo"];

function Events() {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedFormat, setSelectedFormat] = useState("Todos");

  const filteredEvents = useMemo(() => {
    return mockEvents.filter((event) => {
      const matchesCategory =
        selectedCategory === "Todos" || event.category === selectedCategory;

      const matchesFormat =
        selectedFormat === "Todos" || event.format === selectedFormat;

      return matchesCategory && matchesFormat;
    });
  }, [selectedCategory, selectedFormat]);

  return (
    <main className="section events-page">
      <div className="container">
        <div className="events-hero card">
          <div>
            <p className="section-kicker">Eventos</p>
            <h1 className="section-title">Próximos eventos Padel Nation</h1>
            <p className="section-description">
              Explorá pozos, retos y torneos por categoría. Inscribite, competí
              y sumá puntos para subir en el ranking de temporada.
            </p>
          </div>

          <div className="events-hero-stat">
            <span>Eventos activos</span>
            <strong>{mockEvents.length}</strong>
            <small>Disponibles para inscripción</small>
          </div>
        </div>

        <section className="events-filters card">
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

          <div>
            <h2>Formato</h2>
            <div className="filter-list">
              {formats.map((format) => (
                <button
                  key={format}
                  className={
                    selectedFormat === format
                      ? "filter-pill active"
                      : "filter-pill"
                  }
                  onClick={() => setSelectedFormat(format)}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="events-results">
          <div className="events-results-header">
            <div>
              <p className="section-kicker">Disponibles</p>
              <h2>
                {filteredEvents.length}{" "}
                {filteredEvents.length === 1 ? "evento encontrado" : "eventos encontrados"}
              </h2>
            </div>
          </div>

          {filteredEvents.length > 0 ? (
            <div className="events-grid">
              {filteredEvents.map((event) => {
                const occupancy = Math.round(
                  (event.playersRegistered / event.playerLimit) * 100
                );

                return (
                  <article className="event-page-card card" key={event.id}>
                    <div className="event-page-card-header">
                      <span className="badge">{event.format}</span>
                      <span className={`status-pill ${getStatusClass(event.status)}`}>
                        {event.status}
                      </span>
                    </div>

                    <div className="event-category-mark">
                      <span>Categoría</span>
                      <strong>{event.category}</strong>
                    </div>

                    <h3>{event.title}</h3>

                    <div className="event-info-list">
                      <div>
                        <span>Fecha</span>
                        <strong>{event.date}</strong>
                      </div>
                      <div>
                        <span>Hora</span>
                        <strong>{event.time}</strong>
                      </div>
                      <div>
                        <span>Ubicación</span>
                        <strong>{event.location}</strong>
                      </div>
                    </div>

                    <div className="event-progress">
                      <div className="event-progress-top">
                        <span>Cupos</span>
                        <strong>
                          {event.playersRegistered}/{event.playerLimit}
                        </strong>
                      </div>

                      <div className="progress-track">
                        <div
                          className="progress-bar"
                          style={{ width: `${occupancy}%` }}
                        />
                      </div>
                    </div>

                    <div className="event-levels">
                      <span>Niveles permitidos</span>
                      <div>
                        {event.allowedLevels.map((level) => (
                          <strong key={level}>{level}</strong>
                        ))}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary event-register-btn"
                      disabled={event.status === "Cerrado"}
                    >
                      {event.status === "Cerrado" ? "Evento cerrado" : "Inscribirme"}
                    </button>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state card">
              <h3>No encontramos eventos con esos filtros.</h3>
              <p>
                Probá cambiar la categoría o el formato para ver más opciones.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function getStatusClass(status) {
  if (status === "Abierto") return "status-open";
  if (status === "Casi lleno") return "status-warning";
  if (status === "Cerrado") return "status-closed";
  return "";
}

export default Events;