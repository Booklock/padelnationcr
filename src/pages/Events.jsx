import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEvents } from "../hooks/useEvents";
import { useMyRegistrations, registerForEvent, cancelRegistration } from "../hooks/useRegistration";
import { supabase } from "../lib/supabase";
import { FORMAT_LABELS, STATUS_LABELS, STATUS_CLASS, GENDER_FILTER_LABELS, GENDER_FILTER_CLASS, formatEventDate, formatEventTime } from "../utils/formatters";
import "./Events.css";

/* ── Modal de inscripción para eventos de parejas fijas ──────────── */
function PairRegModal({ event, onClose, onSuccess }) {
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [searching,     setSearching]     = useState(false);
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState("");
  const searchRef = useRef(null);
  const debounceTimer = useRef(null);

  // Búsqueda de jugadores con debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, current_level, current_category")
        .ilike("full_name", `%${searchQuery.trim()}%`)
        .eq("role", "player")
        .eq("is_active", true)
        .limit(8);
      setSearchResults(data ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    const { data, error: rpcErr } = await supabase.rpc("register_for_event_pair", {
      p_event_id:   event.id,
      p_partner_id: selectedPartner?.id ?? null,
    });
    setSubmitting(false);
    if (rpcErr) { setError(rpcErr.message); return; }
    if (data?.error) { setError(data.error); return; }
    onSuccess(data);
  }

  const pairCount = Math.floor((event.player_limit ?? 16) / 2);

  return (
    <div className="pair-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pair-modal card">
        <div className="pair-modal-header">
          <div>
            <p className="section-kicker">Parejas fijas</p>
            <h2>Inscripción en pareja</h2>
          </div>
          <button className="pair-modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p className="pair-modal-desc">
          Este evento es de <strong>parejas fijas</strong> ({pairCount} parejas en total).
          Podés inscribirte ahora y buscar pareja después, o indicar tu pareja de inmediato.
        </p>

        {/* Búsqueda de pareja */}
        <div className="pair-modal-search-section">
          <label className="pair-modal-label">
            Buscar pareja (opcional)
          </label>
          {selectedPartner ? (
            <div className="pair-modal-selected">
              <span>
                <strong>{selectedPartner.full_name}</strong>
                <small> · Nivel {selectedPartner.current_level ?? "?"} · Cat. {selectedPartner.current_category ?? "?"}</small>
              </span>
              <button
                className="pair-modal-clear"
                onClick={() => { setSelectedPartner(null); setSearchQuery(""); }}
              >✕</button>
            </div>
          ) : (
            <div className="pair-modal-search-wrap" ref={searchRef}>
              <input
                className="pair-modal-input"
                type="text"
                placeholder="Escribí el nombre del jugador…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {(searching || searchResults.length > 0) && (
                <ul className="pair-modal-results">
                  {searching && (
                    <li className="pair-modal-searching">Buscando…</li>
                  )}
                  {!searching && searchResults.map((p) => (
                    <li
                      key={p.id}
                      className="pair-modal-result-item"
                      onClick={() => { setSelectedPartner(p); setSearchResults([]); setSearchQuery(""); }}
                    >
                      <strong>{p.full_name}</strong>
                      <small>Nivel {p.current_level ?? "?"} · Cat. {p.current_category ?? "?"}</small>
                    </li>
                  ))}
                  {!searching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                    <li className="pair-modal-no-results">Sin resultados para "{searchQuery}"</li>
                  )}
                </ul>
              )}
            </div>
          )}
          <small className="pair-modal-hint">
            {selectedPartner
              ? "Tu pareja recibirá una notificación para confirmar. Si no confirma, podés reasignarla desde tu perfil."
              : "Si no seleccionás pareja ahora, quedás como TBD. El admin puede asignarte una antes de que empiece el evento."}
          </small>
        </div>

        {error && <p className="pair-modal-error">{error}</p>}

        <div className="pair-modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? "Inscribiendo…"
              : selectedPartner
                ? `Inscribirme con ${selectedPartner.full_name}`
                : "Inscribirme (TBD)"}
          </button>
        </div>
      </div>
    </div>
  );
}

const CATEGORIES     = ["Todos", "AA", "A", "B", "C", "D"];
const FORMATS        = ["Todos", "Mexicano", "Americano", "Reto", "Torneo"];
const GENDER_FILTERS = [
  { value: "todos",  label: "Todos" },
  { value: "male",   label: "Masculino" },
  { value: "female", label: "Femenino" },
  { value: "mixed",  label: "Mixto" },
];

function Events() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [selectedFormat,   setSelectedFormat]   = useState("Todos");
  const [selectedGender,   setSelectedGender]   = useState("todos");

  const { events: allEvents, loading, error, refetch: refetchEvents } = useEvents({
    excludeStatuses: ["draft", "cancelled"],
    category: selectedCategory !== "Todos" ? selectedCategory : undefined,
    format:   selectedFormat   !== "Todos" ? selectedFormat   : undefined,
  });

  // Filtro de género (client-side, ya que el hook ya hace la query)
  const events = useMemo(() => {
    if (selectedGender === "todos") return allEvents;
    if (selectedGender === "male")   return allEvents.filter((e) => e.gender_filter === "male");
    if (selectedGender === "female") return allEvents.filter((e) => e.gender_filter === "female");
    if (selectedGender === "mixed")  return allEvents.filter((e) => e.gender_filter === "mixed");
    return allEvents;
  }, [allEvents, selectedGender]);

  const { regs, loading: regsLoading, refetch: refetchRegs } = useMyRegistrations();

  // ID del evento siendo procesado en este momento (para loading states)
  const [actionEventId, setActionEventId] = useState(null);
  // Mensajes de error/info por event_id
  const [actionMsgs, setActionMsgs] = useState({});
  // Modal de inscripción para eventos de pareja
  const [pairModalEvent, setPairModalEvent] = useState(null);

  const activeCount = useMemo(
    () => events.filter((e) => e.status === "open" || e.status === "almost_full").length,
    [events]
  );

  /* ── Elegibilidad (cliente) ───────────────────────────────── */
  // Devuelve { ok, reason } para el jugador logueado.
  // Las autorizaciones especiales se validan solo en el servidor; acá
  // simplemente evitamos el click para el caso más común.
  function getEligibility(event) {
    if (!user || !profile) return { ok: true };  // sin sesión → redirigir al login

    // Chequeo de género
    const gf = event.gender_filter ?? "any";
    if (gf === "male" && profile.gender !== "male") {
      return { ok: false, reason: "gender", label: "Solo masculino" };
    }
    if (gf === "female" && profile.gender !== "female") {
      return { ok: false, reason: "gender", label: "Solo femenino" };
    }
    if (gf === "mixed" && !["male", "female"].includes(profile.gender)) {
      return { ok: false, reason: "gender", label: "Requiere género en perfil" };
    }

    // Chequeo de nivel
    if (!profile.current_level) return { ok: false, reason: "level", label: "Sin nivel asignado" };
    if (!(event.allowed_levels ?? []).includes(profile.current_level)) {
      return { ok: false, reason: "level", label: "Categoría no compatible" };
    }

    return { ok: true };
  }

  /* ── Handlers ────────────────────────────────────────────── */

  function clearMsg(eventId) {
    setActionMsgs((prev) => { const n = { ...prev }; delete n[eventId]; return n; });
  }

  async function handleRegister(event) {
    if (!user) {
      navigate("/login", { state: { from: { pathname: "/eventos" } } });
      return;
    }

    // Eventos de parejas fijas → modal especial
    if (event.pair_format) {
      setPairModalEvent(event);
      return;
    }

    const eventId = event.id;
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

  async function handlePairRegSuccess() {
    setPairModalEvent(null);
    await Promise.all([refetchEvents(), refetchRegs()]);
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

          <div>
            <h2>Género</h2>
            <div className="filter-list">
              {GENDER_FILTERS.map((gf) => (
                <button
                  key={gf.value}
                  className={selectedGender === gf.value ? "filter-pill active" : "filter-pill"}
                  onClick={() => setSelectedGender(gf.value)}
                >
                  {gf.label}
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

                const myReg      = regs[event.id] ?? null;
                const isBusy     = actionEventId === event.id;
                const msg        = actionMsgs[event.id] ?? null;
                const eligResult = getEligibility(event);
                const eligible   = eligResult.ok;
                const gfLabel    = GENDER_FILTER_LABELS[event.gender_filter];
                const gfClass    = GENDER_FILTER_CLASS[event.gender_filter];

                return (
                  <article className="event-page-card card" key={event.id}>
                    <div className="event-page-card-header">
                      <span className="badge">{FORMAT_LABELS[event.format] ?? event.format}</span>
                      {event.pair_format && (
                        <span className="event-pair-badge">👥 Parejas fijas</span>
                      )}
                      {gfLabel && (
                        <span className={`event-gender-badge ${gfClass}`}>{gfLabel}</span>
                      )}
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

                        {/* Estado de pareja para eventos de parejas */}
                        {event.pair_format && myReg.status === "confirmed" && (
                          <span className={`pair-reg-status ${myReg.pair_partner_id ? (myReg.pair_confirmed ? "pair-ok" : "pair-pending") : "pair-tbd"}`}>
                            {!myReg.pair_partner_id
                              ? "👥 Pareja: TBD"
                              : myReg.pair_confirmed
                                ? "✓ Pareja confirmada"
                                : "⏳ Confirmar pareja — revisá tu perfil"}
                          </span>
                        )}

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

                    ) : !eligible && user ? (
                      /* Jugador logueado pero no cumple requisitos */
                      <div className="reg-action-area">
                        <div className="reg-not-eligible">
                          {eligResult.reason === "gender" ? (
                            <>
                              <span>⚠️ {eligResult.label}</span>
                              <small>
                                Este evento tiene restricción de género. Si tu perfil
                                es incorrecto, contactá al admin.
                              </small>
                            </>
                          ) : (
                            <>
                              <span>⚠️ Categoría no compatible</span>
                              <small>
                                Tu nivel ({profile?.current_level ?? "sin asignar"}) no está en los
                                niveles habilitados para este evento.
                              </small>
                            </>
                          )}
                        </div>
                      </div>

                    ) : (
                      /* Jugador no inscrito (o sin sesión) */
                      <div className="reg-action-area">
                        <button
                          className="btn btn-primary event-register-btn"
                          onClick={() => handleRegister(event)}
                          disabled={isBusy || regsLoading}
                        >
                          {isBusy ? "Inscribiendo…" : event.pair_format ? "Inscribirme en pareja" : "Inscribirme"}
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

      {/* Modal inscripción parejas */}
      {pairModalEvent && (
        <PairRegModal
          event={pairModalEvent}
          onClose={() => setPairModalEvent(null)}
          onSuccess={handlePairRegSuccess}
        />
      )}
    </main>
  );
}

export default Events;
