import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import "./AdminSettings.css";

const SETTING_META = {
  no_show_threshold: {
    label:       "Umbral de no-shows para suspensión",
    description: "Cantidad de no-shows que activa la suspensión automática de un jugador.",
    type:        "number",
    min:         1,
    max:         20,
  },
  suspension_days: {
    label:       "Duración de la suspensión (días)",
    description: "Cuántos días dura la suspensión automática cuando se supera el umbral.",
    type:        "number",
    min:         1,
    max:         365,
  },
};

export default function AdminSettings() {
  const { isAdmin } = useAuth();
  const navigate    = useNavigate();

  const [settings,   setSettings]   = useState({});
  const [drafts,     setDrafts]     = useState({});
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(null);   // key being saved
  const [successKey, setSuccessKey] = useState(null);
  const [errorMsg,   setErrorMsg]   = useState(null);

  useEffect(() => {
    if (!isAdmin) { navigate("/no-autorizado"); return; }
    loadSettings();
  }, [isAdmin]);

  async function loadSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("key, value, description, updated_at");

    if (error) {
      setErrorMsg("Error al cargar la configuración: " + error.message);
      setLoading(false);
      return;
    }

    const map = Object.fromEntries((data ?? []).map((s) => [s.key, s]));
    setSettings(map);
    setDrafts(Object.fromEntries((data ?? []).map((s) => [s.key, s.value])));
    setLoading(false);
  }

  async function saveSetting(key) {
    const newValue = String(drafts[key] ?? "").trim();
    if (!newValue) { setErrorMsg("El valor no puede estar vacío."); return; }

    const meta = SETTING_META[key];
    if (meta?.type === "number") {
      const n = Number(newValue);
      if (isNaN(n) || n < (meta.min ?? 1)) {
        setErrorMsg(`El valor mínimo es ${meta.min ?? 1}.`);
        return;
      }
      if (meta.max && n > meta.max) {
        setErrorMsg(`El valor máximo es ${meta.max}.`);
        return;
      }
    }

    setSaving(key);
    setErrorMsg(null);
    setSuccessKey(null);

    const { error } = await supabase.rpc("update_app_setting", {
      p_key:   key,
      p_value: newValue,
    });

    if (error) {
      setErrorMsg("Error al guardar: " + error.message);
    } else {
      setSettings((prev) => ({
        ...prev,
        [key]: { ...prev[key], value: newValue, updated_at: new Date().toISOString() },
      }));
      setSuccessKey(key);
      setTimeout(() => setSuccessKey(null), 3000);
    }

    setSaving(null);
  }

  const knownKeys = Object.keys(SETTING_META);

  return (
    <main className="admin-settings-page section">
      <div className="container">

        <div className="as-header">
          <div>
            <p className="section-kicker">Panel administrativo</p>
            <h1 className="section-title">Configuración</h1>
            <p className="section-description">
              Ajustá los parámetros del sistema de reputación y otras reglas de la plataforma.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate("/admin")}>
            ← Volver al admin
          </button>
        </div>

        {errorMsg && (
          <div className="as-error card" role="alert">
            <span>⚠️ {errorMsg}</span>
            <button className="as-error-close" onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="as-loading">Cargando configuración…</div>
        ) : (
          <>
            <section className="as-group card">
              <h2 className="as-group-title">Sistema de no-shows y reputación</h2>
              <p className="as-group-desc">
                Controlá cuándo se activa la suspensión automática y cuánto tiempo dura.
              </p>

              <div className="as-settings-list">
                {knownKeys.map((key) => {
                  const meta    = SETTING_META[key];
                  const current = settings[key];
                  const isDirty = drafts[key] !== current?.value;

                  return (
                    <div key={key} className="as-setting-row">
                      <div className="as-setting-info">
                        <label className="as-setting-label" htmlFor={`setting-${key}`}>
                          {meta.label}
                        </label>
                        <p className="as-setting-desc">{meta.description}</p>
                        {current?.updated_at && (
                          <small className="as-setting-updated">
                            Última actualización:{" "}
                            {new Intl.DateTimeFormat("es-CR", {
                              day: "2-digit", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            }).format(new Date(current.updated_at))}
                          </small>
                        )}
                      </div>

                      <div className="as-setting-control">
                        <input
                          id={`setting-${key}`}
                          type={meta.type ?? "text"}
                          min={meta.min}
                          max={meta.max}
                          className="as-input"
                          value={drafts[key] ?? ""}
                          onChange={(e) => {
                            setDrafts((prev) => ({ ...prev, [key]: e.target.value }));
                            setErrorMsg(null);
                          }}
                        />
                        <button
                          className={`btn btn-primary as-save-btn ${successKey === key ? "as-save-ok" : ""}`}
                          onClick={() => saveSetting(key)}
                          disabled={saving === key || !isDirty}
                        >
                          {saving === key ? "Guardando…"
                            : successKey === key ? "✓ Guardado"
                            : "Guardar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
