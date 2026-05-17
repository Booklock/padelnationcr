import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useEvents } from "../hooks/useEvents";
import { usePendingChallenges, getPairName } from "../hooks/usePairs";
import { supabase } from "../lib/supabase";
import { FORMAT_LABELS, formatEventDate, formatEventTime } from "../utils/formatters";
import "./AdminDashboard.css";

/** Stats de operación: players, pending matches, temporada activa. */
function useAdminStats() {
  const [stats, setStats] = useState({ players: "…", pendingMatches: "…", season: "…" });

  useEffect(() => {
    async function load() {
      const [playersRes, matchesRes, seasonRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "player"),
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("seasons")
          .select("name")
          .eq("is_active", true)
          .maybeSingle(),
      ]);

      setStats({
        players:        playersRes.count  ?? 0,
        pendingMatches: matchesRes.count  ?? 0,
        season:         seasonRes.data?.name ?? "—",
      });
    }
    load();
  }, []);

  return stats;
}

function AdminDashboard() {
  const { events: activeEvents, loading: eventsLoading } = useEvents({
    excludeStatuses: ["draft", "cancelled", "finished"],
  });
  const stats = useAdminStats();
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  // Mantener índice dentro de los límites al cargar los eventos
  const safeIndex = activeEvents.length > 0
    ? Math.min(currentEventIndex, activeEvents.length - 1)
    : 0;
  const currentEvent = activeEvents[safeIndex] ?? null;

  function goToPrev() {
    setCurrentEventIndex((i) =>
      i === 0 ? Math.max(activeEvents.length - 1, 0) : i - 1
    );
  }

  function goToNext() {
    setCurrentEventIndex((i) =>
      i >= activeEvents.length - 1 ? 0 : i + 1
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
              <strong>{eventsLoading ? "…" : activeEvents.length}</strong>
              <small>Pozos, retos y torneos abiertos</small>
            </div>

            <div className="admin-stat-card card">
              <span>Jugadores registrados</span>
              <strong>{stats.players}</strong>
              <small>Base competitiva actual</small>
            </div>

            <div className="admin-stat-card card">
              <span>Resultados pendientes</span>
              <strong>{stats.pendingMatches}</strong>
              <small>Partidos por actualizar</small>
            </div>

            <div className="admin-stat-card card">
              <span>Temporada actual</span>
              <strong>{stats.season}</strong>
              <small>Ranking activo</small>
            </div>
          </div>

          <div className="admin-layout">

            {/* Carrusel de eventos activos */}
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

              {eventsLoading ? (
                <div className="empty-admin-state"><p>Cargando eventos…</p></div>
              ) : currentEvent ? (
                <div className="admin-event-carousel">
                  <article className="carousel-event-card">
                    <div className="carousel-event-top">
                      <span className="badge">
                        {FORMAT_LABELS[currentEvent.format] ?? currentEvent.format}
                      </span>
                      <span className="carousel-event-count">
                        {safeIndex + 1} de {activeEvents.length}
                      </span>
                    </div>

                    <h3>{currentEvent.title}</h3>

                    <div className="carousel-event-meta">
                      <span>{formatEventDate(currentEvent.starts_at)}</span>
                      <span>{formatEventTime(currentEvent.starts_at)}</span>
                      {currentEvent.location && <span>{currentEvent.location}</span>}
                    </div>

                    <div className="carousel-event-bottom">
                      <span>
                        {currentEvent.players_registered}/{currentEvent.player_limit} cupos
                        {" · "}Categoría {currentEvent.category_code}
                      </span>

                      <Link
                        className="btn btn-primary"
                        to={`/admin/evento/${currentEvent.id}`}
                      >
                        Administrar
                      </Link>
                    </div>
                  </article>

                  {activeEvents.length > 1 && (
                    <div className="carousel-controls">
                      <button
                        className="carousel-nav-btn"
                        onClick={goToPrev}
                        type="button"
                      >
                        ←
                      </button>

                      <div className="carousel-dots">
                        {activeEvents.map((_, index) => (
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
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-admin-state">
                  <p>No hay eventos activos en este momento.</p>
                </div>
              )}
            </section>

            {/* Acciones rápidas */}
            <aside className="card admin-panel">
              <p className="section-kicker">Acciones rápidas</p>
              <h2>Operación diaria</h2>

              <div className="quick-actions">
                <Link className="quick-action" to="/admin/crear-evento">
                  Crear evento
                </Link>
                <Link className="quick-action" to="/ranking">
                  Ver ranking
                </Link>
                <Link className="quick-action" to="/eventos">
                  Ver todos los eventos
                </Link>
                <Link className="quick-action" to="/historial">
                  Historial de pozos
                </Link>
                <Link className="quick-action" to="/admin/jugadores">
                  Gestión de jugadores
                </Link>
                <Link className="quick-action" to="/admin/autorizaciones">
                  Autorizaciones de categoría
                </Link>
                <Link className="quick-action" to="/admin/exclusiones">
                  Exclusiones de ranking
                </Link>
              </div>
            </aside>

          </div>

          {/* Retos de parejas */}
          <PairChallengesWidget />

        </div>
      </section>
    </main>
  );
}

// ── Widget: retos de parejas pendientes / aceptados ──────────────────
function PairChallengesWidget() {
  const { challenges, pairsMap, profileMap, loading, refetch } = usePendingChallenges();

  const [resolvingId,  setResolvingId]  = useState(null); // challenge id being resolved
  const [winnerPairId, setWinnerPairId] = useState("");
  const [resolving,    setResolving]    = useState(false);
  const [resolveMsg,   setResolveMsg]   = useState("");

  async function handleResolve(challengeId) {
    if (!winnerPairId) { setResolveMsg("Seleccioná el ganador."); return; }
    setResolving(true); setResolveMsg("");
    const { error } = await supabase.rpc("resolve_pair_challenge", {
      p_challenge_id:   challengeId,
      p_winner_pair_id: winnerPairId,
    });
    if (error) {
      setResolveMsg("❌ " + error.message);
    } else {
      setResolveMsg("✅ Reto resuelto. Puntos transferidos.");
      setResolvingId(null);
      setWinnerPairId("");
      await refetch();
    }
    setResolving(false);
  }

  const pending  = challenges.filter((c) => c.status === "pending");
  const accepted = challenges.filter((c) => c.status === "accepted");

  if (loading) return null;
  if (challenges.length === 0) return null;

  return (
    <section className="card admin-panel admin-challenges-widget">
      <div className="panel-header">
        <div>
          <p className="section-kicker">Retos</p>
          <h2>
            Retos de parejas
            {challenges.length > 0 && (
              <span className="challenge-count-badge">{challenges.length}</span>
            )}
          </h2>
        </div>
        <Link className="btn btn-secondary" to="/ranking">Ver ranking</Link>
      </div>

      {resolveMsg && (
        <p className={`challenge-widget-msg ${resolveMsg.startsWith("✅") ? "msg-ok" : "msg-err"}`}>
          {resolveMsg}
        </p>
      )}

      {accepted.length > 0 && (
        <div className="challenge-group">
          <p className="challenge-group-label">⚔️ Aceptados — esperando resultado</p>
          {accepted.map((ch) => {
            const chalName = getPairName(ch.challenger_pair_id, pairsMap, profileMap);
            const challName = getPairName(ch.challenged_pair_id, pairsMap, profileMap);
            const isResolving = resolvingId === ch.id;
            return (
              <div key={ch.id} className="challenge-row">
                <div className="challenge-row-info">
                  <span className="challenge-row-pairs">
                    <strong>{chalName}</strong> vs <strong>{challName}</strong>
                  </span>
                  <span className="challenge-row-pts">🎯 {ch.points_wagered} pts</span>
                </div>
                {isResolving ? (
                  <div className="challenge-resolve-form">
                    <select
                      value={winnerPairId}
                      onChange={(e) => setWinnerPairId(e.target.value)}
                      className="challenge-winner-select"
                    >
                      <option value="">Seleccioná el ganador…</option>
                      <option value={ch.challenger_pair_id}>{chalName}</option>
                      <option value={ch.challenged_pair_id}>{challName}</option>
                    </select>
                    <button
                      className="btn btn-primary"
                      onClick={() => handleResolve(ch.id)}
                      disabled={resolving}
                    >
                      {resolving ? "Guardando…" : "Confirmar"}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setResolvingId(null); setWinnerPairId(""); setResolveMsg(""); }}
                      disabled={resolving}
                    >
                      Cancelar
                    </button>
                    {resolveMsg && <span className="challenge-resolve-err">{resolveMsg}</span>}
                  </div>
                ) : (
                  <button
                    className="challenge-resolve-btn"
                    onClick={() => { setResolvingId(ch.id); setWinnerPairId(""); setResolveMsg(""); }}
                  >
                    Registrar resultado
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pending.length > 0 && (
        <div className="challenge-group">
          <p className="challenge-group-label">⏳ Pendientes — esperando respuesta</p>
          {pending.map((ch) => (
            <div key={ch.id} className="challenge-row challenge-row-pending">
              <div className="challenge-row-info">
                <span className="challenge-row-pairs">
                  <strong>{getPairName(ch.challenger_pair_id, pairsMap, profileMap)}</strong>
                  {" → "}
                  <strong>{getPairName(ch.challenged_pair_id, pairsMap, profileMap)}</strong>
                </span>
                <span className="challenge-row-pts">🎯 {ch.points_wagered} pts</span>
              </div>
              <span className="challenge-expires">
                Expira {new Date(ch.expires_at).toLocaleDateString("es-CR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;
