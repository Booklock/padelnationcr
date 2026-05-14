import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useEvents } from "../hooks/useEvents";
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
              </div>
            </aside>

          </div>
        </div>
      </section>
    </main>
  );
}

export default AdminDashboard;
