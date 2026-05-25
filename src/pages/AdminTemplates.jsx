import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import "./AdminTemplates.css";

const FORMAT_LABELS = { mexicano: "Mexicano", americano: "Americano", reto: "Reto", torneo: "Torneo" };
const GENDER_LABELS = { any: "Sin restricción", male: "Masculino", female: "Femenino", mixed: "Mixto" };
const CRITERION_LABELS = { time: "min", points: "pts totales" };

function AdminTemplates() {
  const { user, isAdmin } = useAuth();
  const navigate           = useNavigate();

  const [templates,   setTemplates]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [deleting,    setDeleting]    = useState(null);
  const [error,       setError]       = useState("");

  useEffect(() => {
    if (!isAdmin) { navigate("/no-autorizado"); return; }
    fetchTemplates();
  }, [isAdmin]);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("event_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (fetchErr) setError(fetchErr.message);
    else setTemplates(data ?? []);
    setLoading(false);
  }, []);

  async function handleDelete(id, name) {
    if (!window.confirm(`¿Eliminar la plantilla "${name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(id);
    const { error: delErr } = await supabase.from("event_templates").delete().eq("id", id);
    if (delErr) setError("Error al eliminar: " + delErr.message);
    else setTemplates((prev) => prev.filter((t) => t.id !== id));
    setDeleting(null);
  }

  return (
    <main className="admin-templates-page section">
      <div className="container">

        <div className="at-header">
          <div>
            <p className="section-kicker">Panel administrativo</p>
            <h1 className="section-title">Plantillas de eventos</h1>
            <p className="section-description">
              Guardá configuraciones reutilizables para crear eventos rápidamente.
              Las plantillas se cargan desde el formulario de "Crear evento".
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate("/admin")}>
            ← Volver al admin
          </button>
        </div>

        {error && <p className="at-error">{error}</p>}

        {loading ? (
          <div className="auth-loading"><span>Cargando plantillas…</span></div>
        ) : templates.length === 0 ? (
          <div className="at-empty card">
            <h3>No hay plantillas guardadas</h3>
            <p>
              Al crear un evento, podés usar el botón <strong>"Guardar como plantilla"</strong> para reusar
              esa configuración en el futuro.
            </p>
            <button className="btn btn-primary" onClick={() => navigate("/admin/crear-evento")}>
              Crear primer evento
            </button>
          </div>
        ) : (
          <div className="at-grid">
            {templates.map((t) => (
              <article key={t.id} className="card at-card">
                <div className="at-card-top">
                  <span className="badge">{FORMAT_LABELS[t.format] ?? t.format}</span>
                  {t.pair_format && (
                    <span className="at-pair-badge">👥 Parejas</span>
                  )}
                  {t.gender_filter !== "any" && (
                    <span className="at-gender-badge">{GENDER_LABELS[t.gender_filter]}</span>
                  )}
                </div>

                <h2 className="at-card-name">{t.name}</h2>

                <div className="at-card-meta">
                  <span>
                    {t.allowed_levels?.length > 0
                      ? `Niveles: ${t.allowed_levels.join(", ")}`
                      : "Sin niveles"}
                  </span>
                  <span>{t.player_limit} jugadores · {t.courts} canchas · {t.rounds} rondas</span>
                  <span>
                    Fin: {t.match_end_value} {CRITERION_LABELS[t.match_end_criterion] ?? t.match_end_criterion}
                    {t.warm_up_time > 0 && ` · Calentamiento: ${t.warm_up_time} min`}
                  </span>
                  {t.location && <span>📍 {t.location}</span>}
                  {t.price_crc > 0 && (
                    <span>₡{Number(t.price_crc).toLocaleString("es-CR")}</span>
                  )}
                  {t.point_rules?.length > 0 && (
                    <span>{t.point_rules.length} posiciones con puntos configuradas</span>
                  )}
                </div>

                <div className="at-card-actions">
                  <button
                    className="btn btn-primary at-use-btn"
                    onClick={() => navigate("/admin/crear-evento", { state: { template: t } })}
                  >
                    Usar plantilla
                  </button>
                  <button
                    className="btn btn-danger at-del-btn"
                    onClick={() => handleDelete(t.id, t.name)}
                    disabled={deleting === t.id}
                  >
                    {deleting === t.id ? "…" : "Eliminar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}

export default AdminTemplates;
