import { useState } from "react";
import { useFinishedEvents, useEventFinalResults } from "../hooks/useEvents";
import {
  FORMAT_LABELS,
  CATEGORY_OPTIONS,
  FORMAT_OPTIONS,
  formatEventDate,
} from "../utils/formatters";
import "./EventHistory.css";

const POSITION_MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

function EventHistory() {
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [formatFilter, setFormatFilter] = useState("Todos");
  const [expandedId, setExpandedId] = useState(null);

  const { events, loading, error } = useFinishedEvents({
    category: categoryFilter,
    format: formatFilter,
  });

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <main className="section history-page">
      <div className="container">

        {/* Hero */}
        <section className="history-hero card">
          <div>
            <p className="section-kicker">Resultados</p>
            <h1 className="section-title">Historial de pozos</h1>
            <p className="section-description">
              Consultá los resultados finales de todos los pozos y torneos completados.
              Disponible para todos los jugadores en tiempo real.
            </p>
          </div>
          <div className="history-hero-badge">
            <span>{loading ? "…" : events.length}</span>
            <small>eventos finalizados</small>
          </div>
        </section>

        {/* Filtros */}
        <div className="history-filters card">
          <div className="filter-group">
            <span>Categoría</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="Todos">Todas las categorías</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>Categoría {c}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <span>Formato</span>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value)}
            >
              <option value="Todos">Todos los formatos</option>
              {FORMAT_OPTIONS.map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f] ?? f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="history-state card">
            <p>Cargando historial…</p>
          </div>
        ) : error ? (
          <div className="history-state card">
            <p className="auth-error">Error al cargar eventos: {error.message}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="history-state card">
            <p>No hay eventos finalizados con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="history-list">
            {events.map((ev) => (
              <EventHistoryCard
                key={ev.id}
                event={ev}
                isExpanded={expandedId === ev.id}
                onToggle={() => toggleExpand(ev.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

/* ── Tarjeta con acordeón de resultados ── */
function EventHistoryCard({ event, isExpanded, onToggle }) {
  const { results, loading: resultsLoading } = useEventFinalResults(
    isExpanded ? event.id : null
  );

  return (
    <article className={`history-event-card card${isExpanded ? " expanded" : ""}`}>
      <button className="history-event-header" onClick={onToggle} type="button">
        <div className="history-event-meta">
          <div className="history-event-badges">
            <span className="badge">
              {FORMAT_LABELS[event.format] ?? event.format}
            </span>
            <span className="badge badge-dim">Cat. {event.category_code}</span>
          </div>
          <h3>{event.title}</h3>
          <p className="history-event-details">
            {formatEventDate(event.starts_at)}
            {event.location && ` · ${event.location}`}
            {" · "}
            <strong>{event.players_registered}</strong> jugadores
          </p>
        </div>
        <span className="history-toggle-icon" aria-hidden="true">
          {isExpanded ? "▲" : "▼"}
        </span>
      </button>

      {isExpanded && (
        <div className="history-standings">
          {resultsLoading ? (
            <p className="standings-empty">Cargando posiciones…</p>
          ) : results.length === 0 ? (
            <p className="standings-empty">
              No hay posiciones finales registradas para este evento.
            </p>
          ) : (
            <>
              <div className="history-standings-header">
                <span>Pos.</span>
                <span>Jugador</span>
                <span className="col-record">Partidos</span>
                <span>Puntos</span>
              </div>
              <div className="standings-list">
                {results.map((r) => (
                  <div
                    className={`standings-row${r.final_position <= 3 ? ` top-${r.final_position}` : ""}`}
                    key={r.player_id}
                  >
                    <span className="standings-pos">
                      {POSITION_MEDALS[r.final_position] ?? `#${r.final_position}`}
                    </span>
                    <div className="standings-player">
                      <strong>{r.profiles?.full_name ?? "—"}</strong>
                      <small>
                        Nivel {r.profiles?.current_level ?? "?"} · Cat.{" "}
                        {r.profiles?.current_category ?? "?"}
                      </small>
                    </div>
                    <span className="standings-record col-record">
                      {r.wins}V / {r.ties}E / {r.losses}P
                    </span>
                    <span className="standings-pts">
                      +{r.points_earned}
                      <small> pts</small>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}

export default EventHistory;
