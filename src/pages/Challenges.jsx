import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  useMyChallenges,
  createChallenge,
  respondChallenge,
  searchPlayers,
} from "../hooks/useChallenges";
import "./Challenges.css";

// ── Helpers ───────────────────────────────────────────────────────────

const STATUS_LABELS = {
  pending:   { label: "Esperando respuesta", cls: "ch-status-pending"  },
  accepted:  { label: "Pendiente de admin",  cls: "ch-status-accepted" },
  approved:  { label: "Aprobado",            cls: "ch-status-approved" },
  rejected:  { label: "Rechazado",           cls: "ch-status-rejected" },
  completed: { label: "Completado",          cls: "ch-status-done"     },
  cancelled: { label: "Rechazado",           cls: "ch-status-rejected" },
  expired:   { label: "Expirado",            cls: "ch-status-expired"  },
};

function playerTag(p) {
  if (!p) return "–";
  return `${p.full_name} (${p.current_level ?? "?"})`;
}

function timeLeft(expiresAt) {
  const diff = new Date(expiresAt) - Date.now();
  if (diff <= 0) return "Expirado";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Player search dropdown ─────────────────────────────────────────────

function PlayerSearch({ label, levelFilter, excluded, value, onSelect, placeholder }) {
  const [q, setQ]           = useState("");
  const [results, setRes]   = useState([]);
  const [searching, setSrch] = useState(false);
  const debounce            = useRef(null);

  useEffect(() => {
    if (q.length < 2) { setRes([]); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSrch(true);
      const data = await searchPlayers(q, levelFilter);
      setRes(data.filter((p) => !excluded?.includes(p.id)));
      setSrch(false);
    }, 300);
  }, [q]);

  if (value) {
    return (
      <div className="ch-search-selected">
        <div>
          <strong>{value.full_name}</strong>
          <small>{value.current_level} — {value.current_category}</small>
        </div>
        <button className="ch-clear-btn" onClick={() => onSelect(null)}>✕</button>
      </div>
    );
  }

  return (
    <div className="ch-search-wrap">
      <span className="ch-search-label">{label}</span>
      <div className="ch-search-inner">
        <input
          className="ch-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder ?? "Buscá por nombre…"}
          autoComplete="off"
        />
        {(searching || results.length > 0) && (
          <ul className="ch-search-results">
            {searching && <li className="ch-search-hint">Buscando…</li>}
            {!searching && results.length === 0 && q.length >= 2 && (
              <li className="ch-search-hint">Sin resultados</li>
            )}
            {results.map((p) => (
              <li key={p.id} onClick={() => { onSelect(p); setQ(""); setRes([]); }}>
                <strong>{p.full_name}</strong>
                <small>{p.current_level} — {p.current_category}</small>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Modal: crear reto ─────────────────────────────────────────────────

function CreateModal({ myLevel, myId, onClose, onCreated }) {
  const [challenged, setChallenged] = useState(null);
  const [partner, setPartner]       = useState(null);
  const [points, setPoints]         = useState(10);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!challenged) { setError("Elegí al jugador que querés retar"); return; }
    if (!partner)    { setError("Elegí tu pareja"); return; }
    setError(""); setLoading(true);
    try {
      await createChallenge(challenged.id, partner.id, points);
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const excluded = [myId, challenged?.id, partner?.id].filter(Boolean);

  return (
    <div className="ch-modal-overlay" onClick={onClose}>
      <div className="ch-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="ch-modal-header">
          <div>
            <p className="section-kicker">Reto</p>
            <h2>Crear reto</h2>
          </div>
          <button className="ch-close-btn" onClick={onClose}>✕</button>
        </div>

        <p className="ch-modal-desc">
          Solo podés retar jugadores de tu mismo nivel ({myLevel}).
          La pareja puede ser cualquier jugador registrado.
          Si ganás: +{points} pts cada uno. Si perdés: −{points} pts cada uno.
        </p>

        <form onSubmit={handleSubmit} className="ch-modal-form">
          <PlayerSearch
            label="Jugador a retar"
            levelFilter={myLevel}
            excluded={excluded}
            value={challenged}
            onSelect={setChallenged}
            placeholder="Buscá por nombre (mismo nivel)…"
          />

          <PlayerSearch
            label="Tu pareja"
            excluded={excluded}
            value={partner}
            onSelect={setPartner}
            placeholder="Buscá por nombre…"
          />

          <label className="ch-points-label">
            <span>Puntos a apostar: <strong>{points} pts</strong></span>
            <input
              type="range"
              min={5} max={20} step={5}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="ch-points-slider"
            />
            <div className="ch-points-ticks">
              {[5, 10, 15, 20].map((v) => (
                <span key={v} className={points === v ? "active" : ""}>{v}</span>
              ))}
            </div>
          </label>

          {error && <p className="ch-error">{error}</p>}

          <div className="ch-modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Enviando…" : "Enviar reto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: responder reto ─────────────────────────────────────────────

function RespondModal({ challenge, myId, onClose, onResponded }) {
  const [partner, setPartner]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  async function handleAccept(e) {
    e.preventDefault();
    if (!partner) { setError("Elegí tu pareja para aceptar"); return; }
    setError(""); setLoading(true);
    try {
      await respondChallenge(challenge.id, true, partner.id);
      onResponded();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    try {
      await respondChallenge(challenge.id, false);
      onResponded();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const excluded = [myId, challenge.challenger_id, partner?.id].filter(Boolean);

  return (
    <div className="ch-modal-overlay" onClick={onClose}>
      <div className="ch-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="ch-modal-header">
          <div>
            <p className="section-kicker">Reto recibido</p>
            <h2>Responder reto</h2>
          </div>
          <button className="ch-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="ch-respond-summary">
          <div className="ch-respond-pair">
            <span>Par retador</span>
            <strong>{challenge.challenger?.full_name}</strong>
            <small>+ {challenge.challenger_partner?.full_name}</small>
          </div>
          <div className="ch-respond-vs">VS</div>
          <div className="ch-respond-pair">
            <span>Tu par</span>
            <strong>{challenge.challenged?.full_name}</strong>
            <small>+ ?</small>
          </div>
        </div>

        <div className="ch-respond-info">
          <span>⚡ Puntos apostados: <strong>{challenge.points_wagered} pts por jugador</strong></span>
          <span>⏱ Expira en: <strong>{timeLeft(challenge.expires_at)}</strong></span>
        </div>

        <form onSubmit={handleAccept} className="ch-modal-form">
          <PlayerSearch
            label="Elegí tu pareja"
            excluded={excluded}
            value={partner}
            onSelect={setPartner}
            placeholder="Buscá por nombre…"
          />

          {error && <p className="ch-error">{error}</p>}

          <div className="ch-modal-actions">
            <button
              type="button"
              className="btn btn-secondary ch-reject-btn"
              onClick={handleReject}
              disabled={loading}
            >
              Rechazar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Enviando…" : "Aceptar reto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tarjeta de reto ───────────────────────────────────────────────────

function ChallengeCard({ ch, userId, onRespond }) {
  const isChallenger = ch.challenger_id === userId;
  const isPending    = ch.status === "pending";
  const isReceived   = isPending && !isChallenger;
  const st           = STATUS_LABELS[ch.status] ?? { label: ch.status, cls: "" };

  const myPair = isChallenger
    ? [ch.challenger, ch.challenger_partner]
    : [ch.challenged, ch.challenged_partner];
  const theirPair = isChallenger
    ? [ch.challenged, ch.challenged_partner]
    : [ch.challenger, ch.challenger_partner];

  return (
    <div className={`ch-card card ${isReceived ? "ch-card-received" : ""}`}>
      <div className="ch-card-header">
        <span className={`ch-status-pill ${st.cls}`}>{st.label}</span>
        <span className="ch-card-pts">⚡ {ch.points_wagered} pts/jugador</span>
      </div>

      <div className="ch-card-matchup">
        <div className="ch-pair-col">
          <span className="ch-pair-role">{isChallenger ? "Tu par" : "Par retador"}</span>
          <span className="ch-pair-name">{myPair[0]?.full_name ?? "–"}</span>
          <span className="ch-pair-partner">+ {myPair[1]?.full_name ?? "TBD"}</span>
        </div>
        <div className="ch-vs">VS</div>
        <div className="ch-pair-col ch-pair-right">
          <span className="ch-pair-role">{isChallenger ? "Par retado" : "Tu par"}</span>
          <span className="ch-pair-name">{theirPair[0]?.full_name ?? "–"}</span>
          <span className="ch-pair-partner">+ {theirPair[1]?.full_name ?? "TBD"}</span>
        </div>
      </div>

      {ch.status === "approved" && (
        <div className="ch-approved-info">
          {ch.scheduled_date && (
            <span>📅 {formatDate(ch.scheduled_date)}</span>
          )}
          {ch.court && <span>📍 Cancha {ch.court}</span>}
        </div>
      )}

      {ch.status === "completed" && (
        <div className={`ch-result ${
          (ch.winner_pair === "challenger" && isChallenger) ||
          (ch.winner_pair === "challenged" && !isChallenger)
            ? "ch-result-win" : "ch-result-loss"
        }`}>
          {(ch.winner_pair === "challenger" && isChallenger) ||
           (ch.winner_pair === "challenged" && !isChallenger)
            ? `🏆 Ganaste +${ch.points_wagered} pts`
            : `💔 Perdiste −${ch.points_wagered} pts`}
        </div>
      )}

      {ch.status === "rejected" && ch.admin_notes && (
        <p className="ch-notes">Motivo: {ch.admin_notes}</p>
      )}

      {isPending && (
        <div className="ch-card-footer">
          <span className="ch-expires">⏱ {timeLeft(ch.expires_at)}</span>
          {isReceived && (
            <button className="btn btn-primary ch-respond-btn" onClick={() => onRespond(ch)}>
              Responder →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────

export default function Challenges() {
  const { user, profile } = useAuth();
  const { challenges, loading, refetch } = useMyChallenges();

  const [showCreate, setShowCreate]     = useState(false);
  const [respondTarget, setRespondTarget] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(false);

  const active  = challenges.filter((c) => ["pending","accepted","approved"].includes(c.status));
  const history = challenges.filter((c) => ["completed","rejected","cancelled","expired"].includes(c.status));
  const received = active.filter((c) => c.challenged_id === user?.id && c.status === "pending");

  function handleCreated() {
    setShowCreate(false);
    setCreateSuccess(true);
    refetch();
    setTimeout(() => setCreateSuccess(false), 4000);
  }

  function handleResponded() {
    setRespondTarget(null);
    refetch();
  }

  if (loading) {
    return (
      <main className="challenges-page section">
        <div className="container">
          <p style={{ color: "var(--color-text-muted)" }}>Cargando retos…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="challenges-page section">
      <div className="container">

        {/* Hero */}
        <div className="ch-hero">
          <div>
            <p className="section-kicker">Retos individuales</p>
            <h1 className="ch-title">Mis retos</h1>
            <p className="ch-subtitle">
              Retá a un jugador de tu mismo nivel ({profile?.current_level ?? "–"}).
              Elegís tu pareja y cuántos puntos apostás.
            </p>
          </div>
          <button className="btn btn-primary ch-create-btn" onClick={() => setShowCreate(true)}>
            + Crear reto
          </button>
        </div>

        {createSuccess && (
          <div className="ch-success-banner">
            ✓ Reto enviado. El jugador tiene 48h para responder.
          </div>
        )}

        {/* Recibidos pendientes */}
        {received.length > 0 && (
          <section className="ch-section">
            <h2 className="ch-section-title">
              ⚡ Retos recibidos
              <span className="ch-section-count">{received.length}</span>
            </h2>
            <div className="ch-grid">
              {received.map((ch) => (
                <ChallengeCard
                  key={ch.id}
                  ch={ch}
                  userId={user.id}
                  onRespond={setRespondTarget}
                />
              ))}
            </div>
          </section>
        )}

        {/* Activos */}
        {active.filter((c) => !(c.challenged_id === user?.id && c.status === "pending")).length > 0 && (
          <section className="ch-section">
            <h2 className="ch-section-title">Activos</h2>
            <div className="ch-grid">
              {active
                .filter((c) => !(c.challenged_id === user?.id && c.status === "pending"))
                .map((ch) => (
                  <ChallengeCard key={ch.id} ch={ch} userId={user.id} onRespond={setRespondTarget} />
                ))}
            </div>
          </section>
        )}

        {active.length === 0 && received.length === 0 && (
          <div className="ch-empty card">
            <p>No tenés retos activos.</p>
            <p>Usá el botón <strong>"+ Crear reto"</strong> para retar a un jugador de tu nivel.</p>
          </div>
        )}

        {/* Historial */}
        {history.length > 0 && (
          <section className="ch-section">
            <h2 className="ch-section-title">Historial</h2>
            <div className="ch-grid">
              {history.slice(0, 12).map((ch) => (
                <ChallengeCard key={ch.id} ch={ch} userId={user.id} onRespond={() => {}} />
              ))}
            </div>
          </section>
        )}
      </div>

      {showCreate && (
        <CreateModal
          myLevel={profile?.current_level}
          myId={user?.id}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {respondTarget && (
        <RespondModal
          challenge={respondTarget}
          myId={user?.id}
          onClose={() => setRespondTarget(null)}
          onResponded={handleResponded}
        />
      )}
    </main>
  );
}
