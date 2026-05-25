import { useMemo, useState } from "react";
import { useRanking } from "../hooks/useRanking";
import "./Ranking.css";

const CATEGORIES = ["Todos", "AA", "A", "B", "C", "D"];

// ── Tab: Ranking individual ───────────────────────────────────────────
function IndividualTab() {
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const { ranking, loading, error } = useRanking({ category: selectedCategory });

  const topThree = ranking.slice(0, 3);
  const totalMatches = useMemo(
    () => ranking.reduce((sum, p) => sum + (p.events_counted ?? 0), 0),
    [ranking],
  );
  const avgPoints = useMemo(
    () => ranking.length > 0
      ? Math.round(ranking.reduce((sum, p) => sum + (p.total_points ?? 0), 0) / ranking.length)
      : 0,
    [ranking],
  );

  return (
    <>
      <section className="ranking-summary-grid">
        <div className="ranking-summary-card card">
          <span>Jugadores</span>
          <strong>{loading ? "…" : ranking.length}</strong>
          <small>En esta vista</small>
        </div>
        <div className="ranking-summary-card card">
          <span>Eventos contados</span>
          <strong>{loading ? "…" : totalMatches}</strong>
          <small>Total acumulado</small>
        </div>
        <div className="ranking-summary-card card">
          <span>Promedio puntos</span>
          <strong>{loading ? "…" : avgPoints}</strong>
          <small>Por jugador</small>
        </div>
      </section>

      <section className="ranking-filters card">
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
      </section>

      {loading && <div className="empty-state card"><p>Cargando ranking…</p></div>}
      {error   && (
        <div className="empty-state card">
          <h3>No se pudo cargar el ranking.</h3>
          <p>Verificá tu conexión y recargá.</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="ranking-podium-section">
            <div className="section-header">
              <div>
                <p className="section-kicker">Top jugadores</p>
                <h2 className="section-title">
                  {selectedCategory === "Todos" ? "Top 3 global" : `Top 3 categoría ${selectedCategory}`}
                </h2>
              </div>
            </div>
            {topThree.length > 0 ? (
              <div className="podium-grid">
                {topThree.map((player, index) => (
                  <article className="podium-card card" key={player.player_id}>
                    <div className="podium-position">#{index + 1}</div>
                    <span className="level-pill">{player.level_code ?? "—"}</span>
                    <h3>{player.full_name}</h3>
                    <strong>{player.total_points} pts</strong>
                    <small>{player.events_counted} eventos jugados</small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state card">
                <h3>Aún no hay jugadores en esta categoría.</h3>
                <p>A medida que se jueguen eventos, el ranking se irá llenando.</p>
              </div>
            )}
          </section>

          {ranking.length > 0 && (
            <section className="ranking-table-section">
              <div className="section-header">
                <div>
                  <p className="section-kicker">Tabla completa</p>
                  <h2 className="section-title">Ranking detallado</h2>
                </div>
              </div>
              <div className="ranking-full-table card">
                <div className="ranking-full-row ranking-full-head">
                  <span>Pos</span><span>Jugador</span>
                  <span>Categoría</span><span>Nivel</span>
                  <span>Puntos</span><span>Eventos</span>
                </div>
                {ranking.map((player, index) => (
                  <div className="ranking-full-row" key={player.player_id}>
                    <span>#{index + 1}</span>
                    <div className="ranking-player-cell">
                      <strong>{player.full_name}</strong>
                    </div>
                    <span>{player.category_code ?? "—"}</span>
                    <span className="level-pill">{player.level_code ?? "—"}</span>
                    <strong>{player.total_points}</strong>
                    <span>{player.events_counted}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

// ── Ranking page ──────────────────────────────────────────────────────
function Ranking() {
  return (
    <main className="section ranking-page">
      <div className="container">

        <section className="ranking-hero card">
          <div>
            <p className="section-kicker">Ranking</p>
            <h1 className="section-title">Temporada Padel Nation 2026</h1>
            <p className="section-description">
              Consultá el rendimiento de los jugadores durante la temporada.
            </p>
          </div>
          <div className="ranking-season-card">
            <span>Temporada activa</span>
            <strong>2026</strong>
            <small>Ranking actualizado por eventos jugados</small>
          </div>
        </section>

        <IndividualTab />

      </div>
    </main>
  );
}

export default Ranking;
