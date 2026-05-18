import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import "./AdminAudit.css";

const ACTION_LABELS = {
  category_change:    { label: "Cambio de categoría", color: "audit-blue"   },
  auth_granted:       { label: "Autorización otorgada", color: "audit-green" },
  auth_revoked:       { label: "Autorización revocada", color: "audit-red"   },
  result_excluded:    { label: "Resultado excluido",  color: "audit-orange" },
  result_included:    { label: "Resultado incluido",  color: "audit-green"  },
  challenge_resolved: { label: "Reto resuelto",       color: "audit-purple" },
};

const ACTION_FILTER_OPTIONS = [
  { key: "all",               label: "Todos" },
  { key: "category_change",   label: "Categorías" },
  { key: "auth_granted",      label: "Autorizaciones" },
  { key: "auth_revoked",      label: "Revocaciones" },
  { key: "result_excluded",   label: "Exclusiones" },
  { key: "result_included",   label: "Inclusiones" },
  { key: "challenge_resolved",label: "Retos" },
];

function formatDate(ts) {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("es-CR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(ts));
}

function DataPill({ data }) {
  if (!data) return null;
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return null;
  return (
    <div className="audit-data-pill">
      {entries.map(([k, v]) => (
        <span key={k} className="audit-data-entry">
          <span className="audit-data-key">{k}</span>
          <span className="audit-data-val">{String(v).slice(0, 40)}</span>
        </span>
      ))}
    </div>
  );
}

export default function AdminAudit() {
  const { isAdmin } = useAuth();
  const navigate    = useNavigate();

  const [entries,    setEntries]    = useState([]);
  const [actorMap,   setActorMap]   = useState({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [filterAction, setFilterAction] = useState("all");

  useEffect(() => {
    if (!isAdmin) { navigate("/no-autorizado"); return; }
    loadData();
  }, [isAdmin]);

  async function loadData() {
    setLoading(true);
    setError(null);

    const { data, error: dbErr } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (dbErr) { setError(dbErr.message); setLoading(false); return; }

    const allEntries = data ?? [];
    setEntries(allEntries);

    // Cargar nombres de actores
    const actorIds = [...new Set(allEntries.map((e) => e.actor_id).filter(Boolean))];
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", actorIds);
      const map = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
      setActorMap(map);
    }

    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (filterAction === "all") return entries;
    return entries.filter((e) => e.action === filterAction);
  }, [entries, filterAction]);

  return (
    <main className="audit-page section">
      <div className="container">

        <div className="audit-header">
          <div>
            <p className="section-kicker">Panel administrativo</p>
            <h1 className="section-title">Auditoría</h1>
            <p className="section-description">
              Registro de todos los cambios sensibles realizados por admins.
              Últimas 200 acciones.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate("/admin")}>
            ← Volver al admin
          </button>
        </div>

        {/* Filtros */}
        <div className="audit-filters card">
          {ACTION_FILTER_OPTIONS.map((f) => (
            <button
              key={f.key}
              className={`filter-pill ${filterAction === f.key ? "active" : ""}`}
              onClick={() => setFilterAction(f.key)}
            >
              {f.label}
              {f.key !== "all" && (
                <span className="audit-filter-count">
                  {entries.filter((e) => e.action === f.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="empty-state card"><p>Cargando auditoría…</p></div>
        ) : error ? (
          <div className="empty-state card">
            <h3>No se pudo cargar el registro.</h3>
            <p style={{ marginBottom: 16 }}>{error}</p>
            <button className="btn btn-secondary" onClick={loadData}>Reintentar</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state card">
            <p>No hay registros para este filtro.</p>
          </div>
        ) : (
          <div className="audit-list">
            <div className="audit-list-head">
              <span>Acción</span>
              <span>Admin</span>
              <span>Antes</span>
              <span>Después / Detalle</span>
              <span>Fecha</span>
            </div>

            {filtered.map((entry) => {
              const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: "" };
              return (
                <div key={entry.id} className="audit-row card">
                  <div className="audit-action-cell">
                    <span className={`audit-badge ${meta.color}`}>{meta.label}</span>
                    {entry.notes && (
                      <span className="audit-notes">"{entry.notes}"</span>
                    )}
                  </div>

                  <span className="audit-actor">
                    {actorMap[entry.actor_id] ?? "Admin"}
                  </span>

                  <div className="audit-data-cell">
                    <DataPill data={entry.before_data} />
                  </div>

                  <div className="audit-data-cell">
                    <DataPill data={entry.after_data} />
                  </div>

                  <span className="audit-date">{formatDate(entry.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </main>
  );
}
