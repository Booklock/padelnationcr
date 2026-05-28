import { useState } from "react";
import {
  useAllChallenges,
  adminReviewChallenge,
  adminCompleteChallenge,
} from "../hooks/useChallenges";
import "./AdminChallenges.css";

// ── Helpers ───────────────────────────────────────────────────────────

function pName(p) {
  if (!p) return "–";
  return `${p.full_name} (${p.current_level})`;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Card para retos pendientes de aprobación (status = 'accepted') ────

function PendingApprovalCard({ ch, onRefetch }) {
  const [open, setOpen]       = useState(false);   // approval form expanded
  const [rejectOpen, setRejectOpen] = useState(false);
  const [court, setCourt]     = useState("");
  const [date, setDate]       = useState("");
  const [notes, setNotes]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleApprove() {
    setError(""); setLoading(true);
    try {
      await adminReviewChallenge(
        ch.id, true,
        court || null,
        date  ? new Date(date).toISOString() : null,
        notes || null
      );
      onRefetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    setError(""); setLoading(true);
    try {
      await adminReviewChallenge(ch.id, false, null, null, notes || null);
      onRefetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ach-card card">
      <div className="ach-card-top">
        <div className="ach-matchup">
          <div className="ach-pair">
            <span className="ach-pair-role">Par retador</span>
            <strong>{ch.challenger?.full_name}</strong>
            <span className="ach-pair-partner">+ {ch.challenger_partner?.full_name}</span>
          </div>
          <div className="ach-vs">VS</div>
          <div className="ach-pair">
            <span className="ach-pair-role">Par retado</span>
            <strong>{ch.challenged?.full_name}</strong>
            <span className="ach-pair-partner">+ {ch.challenged_partner?.full_name}</span>
          </div>
        </div>

        <div className="ach-meta">
          <span>⚡ <strong>{ch.points_wagered} pts</strong> por jugador</span>
          <span>📅 Creado: {formatDate(ch.created_at)}</span>
          <span>🎯 Nivel: {ch.challenger?.current_level}</span>
        </div>
      </div>

      {!open && !rejectOpen && (
        <div className="ach-actions">
          <button
            className="btn btn-secondary ach-reject-open"
            onClick={() => { setRejectOpen(true); setOpen(false); }}
          >
            Rechazar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => { setOpen(true); setRejectOpen(false); }}
          >
            Aprobar →
          </button>
        </div>
      )}

      {open && (
        <div className="ach-form">
          <h3 className="ach-form-title">Datos del partido</h3>
          <div className="ach-form-grid">
            <label className="form-field">
              <span>Cancha (opcional)</span>
              <input
                type="text"
                placeholder="Ej: Cancha 3"
                value={court}
                onChange={(e) => setCourt(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Fecha y hora (opcional)</span>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <label className="form-field">
            <span>Notas (opcional)</span>
            <input
              type="text"
              placeholder="Observaciones para los jugadores"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {error && <p className="ach-error">{error}</p>}
          <div className="ach-form-actions">
            <button className="btn btn-secondary" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleApprove} disabled={loading}>
              {loading ? "Aprobando…" : "Confirmar aprobación"}
            </button>
          </div>
        </div>
      )}

      {rejectOpen && (
        <div className="ach-form">
          <h3 className="ach-form-title">Rechazar reto</h3>
          <label className="form-field">
            <span>Motivo (recomendado)</span>
            <input
              type="text"
              placeholder="Ej: La diferencia de puntos es muy grande"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {error && <p className="ach-error">{error}</p>}
          <div className="ach-form-actions">
            <button className="btn btn-secondary" onClick={() => setRejectOpen(false)} disabled={loading}>
              Cancelar
            </button>
            <button
              className="btn ach-confirm-reject"
              onClick={handleReject}
              disabled={loading}
            >
              {loading ? "Rechazando…" : "Confirmar rechazo"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card para retos aprobados pendientes de resultado ─────────────────

function ApprovedCard({ ch, onRefetch }) {
  const [confirming, setConfirming] = useState(null); // 'challenger' | 'challenged' | null
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  async function handleComplete(winner) {
    setError(""); setLoading(true);
    try {
      await adminCompleteChallenge(ch.id, winner);
      onRefetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ach-card card ach-card-approved">
      <div className="ach-card-top">
        <div className="ach-matchup">
          <div className="ach-pair">
            <span className="ach-pair-role">Par retador</span>
            <strong>{ch.challenger?.full_name}</strong>
            <span className="ach-pair-partner">+ {ch.challenger_partner?.full_name}</span>
          </div>
          <div className="ach-vs">VS</div>
          <div className="ach-pair">
            <span className="ach-pair-role">Par retado</span>
            <strong>{ch.challenged?.full_name}</strong>
            <span className="ach-pair-partner">+ {ch.challenged_partner?.full_name}</span>
          </div>
        </div>

        <div className="ach-meta">
          <span>⚡ <strong>{ch.points_wagered} pts</strong> por jugador</span>
          {ch.scheduled_date && <span>📅 {formatDate(ch.scheduled_date)}</span>}
          {ch.court          && <span>📍 Cancha {ch.court}</span>}
        </div>
      </div>

      {!confirming ? (
        <div className="ach-result-btns">
          <p className="ach-result-prompt">¿Quién ganó?</p>
          <div className="ach-actions">
            <button
              className="btn ach-winner-btn"
              onClick={() => setConfirming("challenger")}
            >
              🏆 {ch.challenger?.full_name} + {ch.challenger_partner?.full_name}
            </button>
            <button
              className="btn ach-winner-btn"
              onClick={() => setConfirming("challenged")}
            >
              🏆 {ch.challenged?.full_name} + {ch.challenged_partner?.full_name}
            </button>
          </div>
        </div>
      ) : (
        <div className="ach-form">
          <p className="ach-confirm-text">
            ¿Confirmás que ganó el par de{" "}
            <strong>
              {confirming === "challenger"
                ? `${ch.challenger?.full_name} + ${ch.challenger_partner?.full_name}`
                : `${ch.challenged?.full_name} + ${ch.challenged_partner?.full_name}`}
            </strong>?
            <br />
            <span className="ach-pts-note">
              Ganadores +{ch.points_wagered} pts c/u | Perdedores −{ch.points_wagered} pts c/u
            </span>
          </p>
          {error && <p className="ach-error">{error}</p>}
          <div className="ach-form-actions">
            <button className="btn btn-secondary" onClick={() => setConfirming(null)} disabled={loading}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleComplete(confirming)}
              disabled={loading}
            >
              {loading ? "Cerrando…" : "Sí, confirmar resultado"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta historial ─────────────────────────────────────────────────

function HistoryCard({ ch }) {
  const statusText = {
    completed: "✅ Completado",
    rejected:  "❌ Rechazado",
    cancelled: "❌ Rechazado por el retado",
    expired:   "⏱ Expirado",
  };

  return (
    <div className="ach-card ach-card-history card">
      <div className="ach-hist-header">
        <span className="ach-hist-status">{statusText[ch.status] ?? ch.status}</span>
        <span className="ach-hist-date">{formatDate(ch.created_at)}</span>
      </div>
      <div className="ach-hist-body">
        <span>{pName(ch.challenger)} + {pName(ch.challenger_partner)}</span>
        <span className="ach-vs-sm">vs</span>
        <span>{pName(ch.challenged)} + {pName(ch.challenged_partner)}</span>
      </div>
      {ch.status === "completed" && (
        <div className="ach-hist-result">
          Ganó: <strong>
            {ch.winner_pair === "challenger"
              ? `${ch.challenger?.full_name} + ${ch.challenger_partner?.full_name}`
              : `${ch.challenged?.full_name} + ${ch.challenged_partner?.full_name}`}
          </strong>
          {" · "}±{ch.points_wagered} pts
        </div>
      )}
      {ch.admin_notes && (
        <p className="ach-hist-notes">Nota: {ch.admin_notes}</p>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────

export default function AdminChallenges() {
  const { all, loading, refetch } = useAllChallenges();

  const pendingApproval = all.filter((c) => c.status === "accepted");
  const approved        = all.filter((c) => c.status === "approved");
  const history         = all.filter((c) =>
    ["completed","rejected","cancelled","expired"].includes(c.status)
  );

  if (loading) {
    return (
      <main className="admin-challenges-page section">
        <div className="container">
          <p style={{ color: "var(--color-text-muted)" }}>Cargando retos…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-challenges-page section">
      <div className="container">
        <div className="ach-page-header">
          <p className="section-kicker">Admin</p>
          <h1>Gestión de retos</h1>
          <p className="ach-page-sub">
            Revisá los retos aceptados, aprobá o rechazá según proporcionalidad,
            y cerrá los partidos con el resultado final.
          </p>
        </div>

        {/* Stats */}
        <div className="ach-stats">
          <div className="card ach-stat">
            <span>{pendingApproval.length}</span>
            <small>Pendientes de revisión</small>
          </div>
          <div className="card ach-stat">
            <span>{approved.length}</span>
            <small>Aprobados — sin resultado</small>
          </div>
          <div className="card ach-stat">
            <span>{history.filter((c) => c.status === "completed").length}</span>
            <small>Completados</small>
          </div>
        </div>

        {/* Pendientes de aprobación */}
        <section className="ach-section">
          <h2 className="ach-section-title">
            ⚡ Pendientes de revisión
            {pendingApproval.length > 0 && (
              <span className="ach-badge">{pendingApproval.length}</span>
            )}
          </h2>
          {pendingApproval.length === 0 ? (
            <p className="ach-empty">No hay retos pendientes de revisión.</p>
          ) : (
            <div className="ach-list">
              {pendingApproval.map((ch) => (
                <PendingApprovalCard key={ch.id} ch={ch} onRefetch={refetch} />
              ))}
            </div>
          )}
        </section>

        {/* Aprobados — pendientes de resultado */}
        <section className="ach-section">
          <h2 className="ach-section-title">
            ✅ Aprobados — pendientes de resultado
            {approved.length > 0 && (
              <span className="ach-badge ach-badge-green">{approved.length}</span>
            )}
          </h2>
          {approved.length === 0 ? (
            <p className="ach-empty">No hay retos aprobados sin resultado.</p>
          ) : (
            <div className="ach-list">
              {approved.map((ch) => (
                <ApprovedCard key={ch.id} ch={ch} onRefetch={refetch} />
              ))}
            </div>
          )}
        </section>

        {/* Historial */}
        {history.length > 0 && (
          <section className="ach-section">
            <h2 className="ach-section-title">Historial</h2>
            <div className="ach-list">
              {history.slice(0, 20).map((ch) => (
                <HistoryCard key={ch.id} ch={ch} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
