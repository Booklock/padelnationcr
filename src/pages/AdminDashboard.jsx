import { Link } from "react-router-dom";
import { mockEvents } from "../data/mockEvents";
import "./AdminDashboard.css";

function AdminDashboard() {
  const activeEvents = mockEvents.filter((event) => event.status !== "Cerrado");

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

            <Link className="btn btn-primary" to="/admin/crear-evento">Crear nuevo evento</Link>
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

              <div className="admin-event-list">
                {activeEvents.map((event) => (
                  <article className="admin-event-item" key={event.id}>
                    <div>
                      <span className="badge">{event.format}</span>
                      <h3>{event.title}</h3>
                      <p>
                        {event.date} · {event.time} · {event.location}
                      </p>
                    </div>

                    <div className="admin-event-actions">
                      <span>
                        {event.playersRegistered}/{event.playerLimit} cupos
                      </span>
                      <Link
                        className="btn btn-primary"
                        to={`/admin/evento/${event.id}`}
                      >
                        Administrar
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
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