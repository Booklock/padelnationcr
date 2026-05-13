import { useAuth } from "../contexts/AuthContext";
import { useProfile } from "../hooks/useProfile";
import { formatEventDate, formatEventTime, FORMAT_LABELS, STATUS_LABELS, getInitials } from "../utils/formatters";
import "./PlayerProfile.css";

function PlayerProfile() {
  const { isAdmin } = useAuth();
  const { profile, registrations, results, rankingInfo, loading } = useProfile();

  if (loading) {
    return (
      <main className="section profile-page">
        <div className="container">
          <div className="auth-loading"><span>Cargando perfil…</span></div>
        </div>
      </main>
    );
  }

  const displayName   = profile?.full_name  ?? "Jugador";
  const category      = profile?.current_category ?? "—";
  const level         = profile?.current_level    ?? "—";
  const totalPoints   = rankingInfo?.total_points   ?? 0;
  const rankingPos    = rankingInfo?.position       ?? "—";
  const eventsPlayed  = rankingInfo?.events_counted ?? 0;

  // Stats calculadas del historial (no del ranking view, que es solo puntos)
  const totalWins    = results.reduce((s, r) => s + (r.wins   ?? 0), 0);
  const totalTies    = results.reduce((s, r) => s + (r.ties   ?? 0), 0);
  const totalLosses  = results.reduce((s, r) => s + (r.losses ?? 0), 0);
  const totalMatches = totalWins + totalTies + totalLosses;
  const winRate      = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;

  const upcomingRegs = registrations.filter(
    (r) => r.events?.status !== "finished" && r.events?.status !== "cancelled"
  );

  const recentResults = results.slice(0, 5);

  return (
    <main className="section profile-page">
      <div className="container">

        {/* Hero */}
        <section className="profile-hero card">
          <div className="profile-identity">
            <div className="profile-avatar">{getInitials(displayName)}</div>
            <div>
              <p className="section-kicker">{isAdmin ? "Admin" : "Mi perfil"}</p>
              <h1 className="section-title">{displayName}</h1>
              <p className="section-description">
                Seguí tu rendimiento, próximos eventos e historial competitivo.
              </p>
            </div>
          </div>

          <div className="profile-level-card">
            <span>Nivel actual</span>
            <strong>{level}</strong>
            <small>Categoría {category}</small>
            <small style={{ marginTop: 6, opacity: 0.7 }}>
              Los cambios de nivel los decide el administrador.
            </small>
          </div>
        </section>

        {/* Stats */}
        <section className="profile-stats-grid">
          <div className="profile-stat-card card">
            <span>Puntos temporada</span>
            <strong>{totalPoints}</strong>
            <small>Ranking #{rankingPos}</small>
          </div>
          <div className="profile-stat-card card">
            <span>Eventos jugados</span>
            <strong>{eventsPlayed}</strong>
            <small>{totalWins} victorias · {totalTies} empates</small>
          </div>
          <div className="profile-stat-card card">
            <span>Win rate</span>
            <strong>{winRate}%</strong>
            <small>{totalWins}G / {totalTies}E / {totalLosses}P</small>
          </div>
          <div className="profile-stat-card card">
            <span>Próximos eventos</span>
            <strong>{upcomingRegs.length}</strong>
            <small>Inscripciones activas</small>
          </div>
        </section>

        <section className="profile-main-grid">
          <div className="profile-left-column">

            {/* Historial reciente */}
            <article className="card profile-panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Historial</p>
                  <h2>Actividad reciente</h2>
                </div>
              </div>

              {recentResults.length === 0 ? (
                <p className="profile-empty">Aún no hay resultados registrados.</p>
              ) : (
                <div className="history-list">
                  {recentResults.map((item) => (
                    <div className="history-item" key={item.id}>
                      <div>
                        <strong>{item.events?.title ?? "Evento"}</strong>
                        <small>
                          {formatEventDate(item.events?.starts_at)} ·{" "}
                          {item.wins}V / {item.ties}E / {item.losses}P
                        </small>
                      </div>
                      <span className={item.excluded ? "points-excluded" : ""}>
                        {item.excluded ? "(excluido)" : `+${item.points_earned} pts`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>

          <aside className="profile-right-column">

            {/* Próximos eventos */}
            <article className="card profile-panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Agenda</p>
                  <h2>Próximos eventos</h2>
                </div>
              </div>

              {upcomingRegs.length === 0 ? (
                <p className="profile-empty">No tenés eventos próximos.</p>
              ) : (
                <div className="profile-events-list">
                  {upcomingRegs.map((reg) => (
                    <div className="profile-event-card" key={reg.id}>
                      <span className="badge">
                        {reg.status === "waitlist" ? "Lista de espera" : STATUS_LABELS[reg.events?.status] ?? "Confirmado"}
                      </span>
                      <h3>{reg.events?.title ?? "Evento"}</h3>
                      <p>{formatEventDate(reg.events?.starts_at)} · {formatEventTime(reg.events?.starts_at)}</p>
                      {reg.events?.location && <small>{reg.events.location}</small>}
                    </div>
                  ))}
                </div>
              )}
            </article>

            {/* Placeholder futuro premium */}
            <article className="card profile-panel premium-preview">
              <span className="badge">Futuro Premium</span>
              <h2>Estadísticas avanzadas</h2>
              <p>
                En una fase futura se podrán ver análisis avanzado, tendencias de
                rendimiento e historial completo.
              </p>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default PlayerProfile;
