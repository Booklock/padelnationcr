import { useMemo, useState } from "react";
import { useEvents } from "../hooks/useEvents";
import { FORMAT_LABELS, STATUS_LABELS, STATUS_CLASS, formatEventDate, formatEventTime } from "../utils/formatters";
import "./Events.css";

const CATEGORIES = ["Todos", "AA", "A", "B", "C", "D"];
const FORMATS    = ["Todos", "Mexicano", "Americano", "Reto", "Torneo"];

function Events() {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedFormat,   setSelectedFormat]   = useState("Todos");

  const { events, loading, error } = useEvents({
    excludeStatuses: ["draft", "cancelled"],
    category: selectedCategory !== "Todos" ? selectedCategory : undefined,
    format:   selectedFormat   !== "Todos" ? selectedFormat   : undefined,
  });

  const activeCount = useMemo(
    () => events.filter((e) => e.status === "open" || e.status === "almost_full").length,
    [events]
  );

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
            <strong>{loading ? "…" : activeCount}</strong>
            <small>Disponibles para inscripción</small>
          </div>
        </div>

        <section className="events-filters card">
          <div>
            <h2>Categoría</h2>
            <div className="filter-list">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={selectedCategory === cat ? "filter-pill active" : "filter-pill"}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2>Formato</h2>
            <div className="filter-list">
              {FORMATS.map((fmt) => (
                <button
                  key={fmt}
                  className={selectedFormat === fmt ? "filter-pill active" : "filter-pill"}
                  onClick={() => setSelectedFormat(fmt)}
                >
                  {fmt}
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
                {loading ? "Cargando…" : `${events.length} ${events.length === 1 ? "evento encontrado" : "eventos encontrados"}`}
              </h2>
            </div>
          </div>

          {loading && (
            <div className="empty-state card">
              <p>Cargando eventos…</p>
            </div>
          )}

          {error && (
            <div className="empty-state card">
              <h3>No se pudieron cargar los eventos.</h3>
              <p>Verificá tu conexión y recargá la página.</p>
            </div>
          )}

          {!loading && !error && events.length === 0 && (
            <div className="empty-state card">
              <h3>No encontramos eventos con esos filtros.</h3>
              <p>Probá cambiar la categoría o el formato.</p>
            </div>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="events-grid">
              {events.map((event) => {
                const occupancy = event.player_limit > 0
                  ? Math.round((event.players_registered / event.player_limit) * 100)
                  : 0;
                const isClosed = event.status === "closed" || event.status === "finished";
                const statusLabel = STATUS_LABELS[event.status] ?? event.status;
                const statusClass = STATUS_CLASS[event.status] ?? "";

                return (
                  <article className="event-page-card card" key={event.id}>
                    <div className="event-page-card-header">
                      <span className="badge">{FORMAT_LABELS[event.format] ?? event.format}</span>
                      <span className={`status-pill ${statusClass}`}>{statusLabel}</span>
                    </div>

                    <div className="event-category-mark">
                      <span>Categoría</span>
                      <strong>{event.category_code}</strong>
                    </div>

                    <h3>{event.title}</h3>

                    <div className="event-info-list">
                      <div>
                        <span>Fecha</span>
                        <strong>{formatEventDate(event.starts_at)}</strong>
                      </div>
                      <div>
                        <span>Hora</span>
                        <strong>{formatEventTime(event.starts_at)}</strong>
                      </div>
                      {event.location && (
                        <div>
                          <span>Ubicación</span>
                          <strong>{event.location}</strong>
                        </div>
                      )}
                    </div>

                    <div className="event-progress">
                      <div className="event-progress-top">
                        <span>Cupos</span>
                        <strong>{event.players_registered}/{event.player_limit}</strong>
                      </div>
                      <div className="progress-track">
                        <div className="progress-bar" style={{ width: `${occupancy}%` }} />
                      </div>
                    </div>

                    {event.allowed_levels?.length > 0 && (
                      <div className="event-levels">
                        <span>Niveles permitidos</span>
                        <div>
                          {event.allowed_levels.map((lvl) => (
                            <strong key={lvl}>{lvl}</strong>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      className="btn btn-primary event-register-btn"
                      disabled={isClosed}
                    >
                      {isClosed ? "Evento cerrado" : "Inscribirme"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default Events;
