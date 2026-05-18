import { useMemo, useState } from "react";
import { useRanking } from "../hooks/useRanking";
import { usePairsRanking, usePairs, getPairName } from "../hooks/usePairs";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import "./Ranking.css";

const CATEGORIES = ["Todos", "AA", "A", "B", "C", "D"];
const TABS = ["Individual", "Parejas"];

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

// ── Tab: Ranking de parejas ───────────────────────────────────────────
function PairsTab() {
  const { user }                        = useAuth();
  const { pairs, loading: pairsLoading, error: pairsError, refetch } = usePairsRanking();
  const { myPair, pairsMap, profileMap, loading: myLoading } = usePairs();

  // Challenge form state
  const [challengingId, setChallengingId] = useState(null); // pair_id being challenged
  const [betPoints,     setBetPoints]     = useState(10);
  const [betMessage,    setBetMessage]    = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [challengeMsg,  setChallengeMsg]  = useState("");

  // My pair's position in ranking
  const myPairInRanking = useMemo(
    () => myPair ? pairs.find((p) => p.pair_id === myPair.id) : null,
    [pairs, myPair],
  );
  const myPos = Number(myPairInRanking?.position ?? 0);

  function canChallenge(targetPair) {
    if (!user || !myPair || !myPairInRanking) return false;
    if (targetPair.pair_id === myPair.id)     return false;
    const targetPos = Number(targetPair.position);
    return myPos > targetPos && (myPos - targetPos) <= 5;
  }

  async function submitChallenge() {
    if (!myPair || !challengingId) return;
    setSubmitting(true); setChallengeMsg("");
    const { error } = await supabase.rpc("send_pair_challenge", {
      p_challenger_pair_id: myPair.id,
      p_challenged_pair_id: challengingId,
      p_points_wagered:     betPoints,
      p_message:            betMessage.trim() || null,
    });
    if (error) {
      setChallengeMsg("❌ " + error.message);
    } else {
      setChallengeMsg("✅ Reto enviado. La pareja tiene 7 días para responder.");
      setChallengingId(null);
      setBetPoints(10);
      setBetMessage("");
      await refetch();
    }
    setSubmitting(false);
  }

  if (pairsLoading || myLoading) {
    return <div className="empty-state card"><p>Cargando ranking de parejas…</p></div>;
  }

  if (pairsError) {
    return (
      <div className="empty-state card">
        <h3>No se pudo cargar el ranking de parejas.</h3>
        <p style={{ marginBottom: 16 }}>Verificá tu conexión e intentá de nuevo.</p>
        <button className="btn btn-secondary" onClick={refetch}>Reintentar</button>
      </div>
    );
  }

  if (pairs.length === 0) {
    return (
      <div className="empty-state card">
        <h3>Aún no hay parejas registradas.</h3>
        <p>Formá una pareja desde tu perfil y empezá a competir.</p>
      </div>
    );
  }

  return (
    <section className="ranking-table-section">
      <div className="section-header">
        <div>
          <p className="section-kicker">Ranking de parejas</p>
          <h2 className="section-title">Parejas fijas — temporada</h2>
        </div>
      </div>

      {challengeMsg && (
        <p className={`pairs-global-msg ${challengeMsg.startsWith("✅") ? "msg-ok" : "msg-err"}`}>
          {challengeMsg}
        </p>
      )}

      <div className="ranking-full-table card">
        <div className="ranking-full-row ranking-full-head pairs-head">
          <span>Pos</span>
          <span>Pareja</span>
          <span>Pts eventos</span>
          <span>Pts retos</span>
          <span>Total</span>
          <span></span>
        </div>

        {pairs.map((pair) => {
          const isMe        = pair.pair_id === myPair?.id;
          const canCh       = canChallenge(pair);
          const isChallenging = challengingId === pair.pair_id;

          return (
            <div
              key={pair.pair_id}
              className={`ranking-full-row pairs-row ${isMe ? "pairs-row-me" : ""}`}
            >
              <span className="pairs-pos">#{Number(pair.position)}</span>

              <div className="pairs-names">
                <strong>{pair.name}</strong>
                <small>
                  {pair.player_a?.full_name ?? "?"} · {pair.player_b?.full_name ?? "?"}
                </small>
              </div>

              <span>{Number(pair.total_points) - Number(pair.challenge_points ?? 0)}</span>
              <span className={Number(pair.challenge_points ?? 0) >= 0 ? "pts-positive" : "pts-negative"}>
                {Number(pair.challenge_points ?? 0) >= 0 ? "+" : ""}
                {pair.challenge_points ?? 0}
              </span>
              <strong>{pair.total_points}</strong>

              <div className="pairs-action">
                {isMe ? (
                  <span className="pairs-me-tag">Vos</span>
                ) : canCh ? (
                  <button
                    className="btn-retar"
                    onClick={() => {
                      setChallengingId(isChallenging ? null : pair.pair_id);
                      setChallengeMsg("");
                    }}
                  >
                    {isChallenging ? "Cancelar" : "⚔️ Retar"}
                  </button>
                ) : null}
              </div>

              {/* Inline challenge form */}
              {isChallenging && (
                <div className="challenge-form-inline">
                  <p className="challenge-form-title">
                    Retar a <strong>{pair.name}</strong>
                    <span className="challenge-pos-hint">
                      (ellos #{Number(pair.position)} · vos #{myPos})
                    </span>
                  </p>
                  <div className="challenge-form-fields">
                    <label className="form-field">
                      <span>Puntos en juego *</span>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={betPoints}
                        onChange={(e) => setBetPoints(Number(e.target.value))}
                      />
                    </label>
                    <label className="form-field">
                      <span>Mensaje (opcional)</span>
                      <input
                        type="text"
                        placeholder="Nos vemos en la cancha…"
                        value={betMessage}
                        onChange={(e) => setBetMessage(e.target.value)}
                        maxLength={200}
                      />
                    </label>
                  </div>
                  <div className="challenge-form-btns">
                    <button
                      className="btn btn-primary"
                      onClick={submitChallenge}
                      disabled={submitting || betPoints < 1}
                    >
                      {submitting ? "Enviando…" : "Confirmar reto"}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => { setChallengingId(null); setChallengeMsg(""); }}
                      disabled={submitting}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {myPair && myPos > 0 && (
        <p className="pairs-challenge-note">
          ⚔️ Podés retar a las parejas que estén entre 1 y 5 posiciones por encima de la tuya.
        </p>
      )}
      {!myPair && user && (
        <p className="pairs-challenge-note">
          Para retar a otras parejas, primero formá una pareja fija desde tu perfil.
        </p>
      )}
    </section>
  );
}

// ── Ranking page ──────────────────────────────────────────────────────
function Ranking() {
  const [activeTab, setActiveTab] = useState("Individual");

  return (
    <main className="section ranking-page">
      <div className="container">

        <section className="ranking-hero card">
          <div>
            <p className="section-kicker">Ranking</p>
            <h1 className="section-title">Temporada Padel Nation 2026</h1>
            <p className="section-description">
              Consultá el rendimiento de jugadores y parejas durante la temporada.
            </p>
          </div>
          <div className="ranking-season-card">
            <span>Temporada activa</span>
            <strong>2026</strong>
            <small>Ranking actualizado por eventos y retos</small>
          </div>
        </section>

        {/* Tab switcher */}
        <div className="ranking-tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`ranking-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "Individual" ? <IndividualTab /> : <PairsTab />}

      </div>
    </main>
  );
}

export default Ranking;
