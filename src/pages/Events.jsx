import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEvents } from "../hooks/useEvents";
import { useMyRegistrations, registerForEvent, cancelRegistration } from "../hooks/useRegistration";
import { FORMAT_LABELS, STATUS_LABELS, STATUS_CLASS, formatEventDate, formatEventTime } from "../utils/formatters";
import "./Events.css";

const CATEGORIES = ["Todos", "AA", "A", "B", "C", "D"];
const FORMATS    = ["Todos", "Mexicano", "Americano", "Reto", "Torneo"];

function Events() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedFormat,   setSelectedFormat]   = useState("Todos");

  const { events, loading, error, refetch: refetchEvents } = useEvents({
    excludeStatuses: ["draft", "cancelled"],
    category: selectedCategory !== "Todos" ? selectedCategory : undefined,
    format:   selectedFormat   !== "Todos" ? selectedFormat   : undefined,
  });

  const { regs, loading: regsLoading, refetch: refetchRegs } = useMyRegistrations();

  // ID del evento siendo procesado en este momento (para loading states)
  const [actionEventId, setActionEventId] = useState(null);
  // Mensajes de error/info por event_id
  const [actionMsgs, setActionMsgs] = useState({});

  const activeCount = useMemo(
    () => events.filter((e) => e.status === "open" || e.status === "almost_full").length,
    [events]
  );

  /* ── Handlers ────────────────────────────────────────────── */

  function clearMsg(eventId) {
    setActionMsgs((prev) => { const n = { ...prev }; delete n[eventId]; return n; });
  }

  async function handleRegister(eventId) {
    if (!user) {
      navigate("/login", { state: { from: { pathname: "/eventos" } } });
      return;
    }

    setActionEventId(eventId);
    clearMsg(eventId);

    try {
      const result = await registerForEvent(eventId);
      await Promise.all([refetchEvents(), refetchRegs()]);

      // Informar al usuario si quedó en lista de espera
      if (result.status === "waitlist") {
        setActionMsgs((prev) => ({
          ...prev,
          [eventId]: { type: "info", text: `Estás en lista de espera, posición #${result.waitlist_pos}.` },
        }));
      }
    } catch (err) {
      setActionMsgs((prev) => ({
        ...prev,
        [eventId]: { type: "error", text: err.message },
      }));
    } finally {
      setActionEventId(null);
    }
  }

  async function handleCancel(eventId) {
    if (!window.confirm("¿Cancelar tu inscripción a este evento?")) return;

    setActionEventId(eventId);
    clearMsg(eventId);

    try {
      await cancelRegistration(eventId);
      await Promise.all([refetchEvents(), refetchRegs()]);
    } catch (err) {
      setActionMsgs((prev) => ({
        ...prev,
        [eventId]: { type: "error", text: err.message },
      }));
    } finally {
      setActionEventId(null);
    }
  }

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <main className="section events-page">
      <div className="container">

        {/* Hero */}
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

        {/* Filtros */}
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

        {/* Resultados */}
        <section className="events-results">
          <div className="events-results-header">
            <div>
              <p className="section-kicker">Disponibles</p>
              <h2>
                {loading
                  ? "Cargando…"
                  : `${events.length} ${events.length === 1 ? "evento encontrado" : "eventos encontrados"}`}
              </h2>
            </div>
          </div>

          {loading && (
            <div className="empty-state card"><p>Cargando eventos…</p></div>
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
                const occupancy   = event.player_limit > 0
                  ? Math.round((event.players_registered / event.player_limit) * 100)
                  : 0;
                const isClosed    = event.status === "closed" || event.status === "finished";
                const statusLabel = STATUS_LABELS[event.status] ?? event.status;
                const statusClass = STATUS_CLASS[event.status] ?? "";

                const myReg   = regs[event.id] ?? null;
                const isBusy  = actionEventId === event.id;
                const msg     = actionMsgs[event.id] ?? null;

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

                    {/* ── Área de inscripción / estado ──────────── */}
                    {isClosed ? (
                      <button className="btn btn-primary event-register-btn" disabled>
                        Evento cerrado
                      </button>

                    ) : myReg && !regsLoading ? (
                      /* Jugador ya inscrito */
                      <div className="reg-status-area">
                        <span className={`reg-badge ${myReg.status === "confirmed" ? "reg-confirmed" : "reg-waitlist"}`}>
                          {myReg.status === "confirmed"
                            ? "✓ Inscrito"
                            : `Lista de espera #${myReg.waitlist_position}`}
                        </span>

                        {msg && (
                          <p className={msg.type === "error" ? "reg-error" : "reg-info"}>
                            {msg.text}
                          </p>
                        )}

                        <button
                          className="btn reg-cancel-btn"
                          onClick={() => handleCancel(event.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Cancelando…" : "Cancelar inscripción"}
                        </button>
                      </div>

                    ) : (
                      /* Jugador no inscrito */
                      <div className="reg-action-area">
                        <button
                          className="btn btn-primary event-register-btn"
                          onClick={() => handleRegister(event.id)}
                          disabled={isBusy || regsLoading}
                        >
                          {isBusy ? "Inscribiendo…" : "Inscribirme"}
                        </button>

                        {msg && (
                          <p className={msg.type === "error" ? "reg-error" : "reg-info"}>
                            {msg.text}
                          </p>
                        )}
                      </div>
                    )}
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
