import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { combineDateTime } from "../utils/formatters";
import "./CreateEvent.css";

const EVENT_FORMATS = ["Mexicano", "Americano", "Reto", "Torneo"];

// Todos los niveles agrupados por categoría — para el selector de pills
const LEVELS_BY_CAT = [
  { cat: "AA", levels: ["AA"] },
  { cat: "A",  levels: ["A+", "A", "A-"] },
  { cat: "B",  levels: ["B+", "B", "B-"] },
  { cat: "C",  levels: ["C+", "C", "C-"] },
  { cat: "D",  levels: ["D+", "D", "D-"] },
];

// Deriva el código de categoría para display a partir de los niveles seleccionados
// Ej: ["B+","A-"] → "A/B" | ["B+","B","B-"] → "B"
function deriveCategoryCode(levels) {
  if (levels.length === 0) return "—";
  const getCat = (l) => l.replace(/[+-]$/, "");
  const cats = [...new Set(levels.map(getCat))].sort();
  return cats.join("/");
}

const FORMAT_DESCRIPTIONS = {
  Mexicano:
    "La primera ronda se genera al azar. Después, las siguientes rondas se organizan según el puntaje acumulado de cada jugador.",
  Americano:
    "El calendario se genera desde el inicio como rotación todos contra todos, sin reorganizar por puntaje entre rondas.",
  Reto:
    "Se configura un enfrentamiento directo entre jugadores o parejas. El resultado puede impactar el ranking de forma puntual.",
  Torneo:
    "Formato futuro para llaves, grupos, semifinales y final. Ideal para eventos competitivos más grandes.",
};

// Etiquetas y descripciones del criterio de fin de partido
const CRITERION_LABELS = {
  time:   "Duración (minutos)",
  points: "Total de puntos a jugar",
};

const CRITERION_HINTS = {
  time:   "Los partidos terminan cuando se acaba el tiempo. Ej.: 15 min.",
  points: "La partida termina cuando la suma de puntos de ambos equipos alcanza el total configurado. Ej.: 24 puntos — si el marcador es 14-10 el partido termina.",
};

// Escala de puntos por defecto — se genera dinámicamente para cualquier cupo
function defaultPointsForPosition(pos) {
  // Top 8 con escala fija; del 9 en adelante decrece linealmente hasta 1
  const fixed = [100, 80, 65, 52, 40, 30, 20, 10];
  if (pos <= fixed.length) return fixed[pos - 1];
  return Math.max(1, 10 - (pos - 8));   // 9→9, 10→8, 11→7 … mín 1
}

function buildInitialRules(playerLimit) {
  const count = Number(playerLimit);
  return Array.from({ length: count }, (_, i) => ({
    position: i + 1,
    points:   defaultPointsForPosition(i + 1),
  }));
}

function CreateEvent() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const [formData, setFormData] = useState({
    title:              "",
    format:             "Mexicano",
    selectedLevels:     ["B+", "B", "B-"],
    genderFilter:       "any",
    pairFormat:         false,
    date:               "",
    time:               "19:00",
    location:           "",
    playerLimit:        16,
    courts:             4,
    rounds:             4,
    matchEndCriterion:  "time",
    matchEndValue:      15,
    warmUpTime:         0,
    price:              0,
    prize:              "",
  });

  // Tabla de puntos por posición — editable por el admin
  const [pointRules, setPointRules] = useState(() => buildInitialRules(16));

  const [saving,         setSaving]         = useState(false);
  const [saveError,      setSaveError]      = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateMsg,    setTemplateMsg]    = useState("");

  // Cargar plantilla si viene desde /admin/plantillas
  useEffect(() => {
    const t = location.state?.template;
    if (!t) return;
    setFormData((prev) => ({
      ...prev,
      format:            t.format ? t.format.charAt(0).toUpperCase() + t.format.slice(1) : prev.format,
      selectedLevels:    t.allowed_levels?.length > 0 ? t.allowed_levels : prev.selectedLevels,
      genderFilter:      t.gender_filter     ?? prev.genderFilter,
      pairFormat:        t.pair_format       ?? prev.pairFormat,
      location:          t.location          ?? prev.location,
      playerLimit:       t.player_limit      ?? prev.playerLimit,
      courts:            t.courts            ?? prev.courts,
      rounds:            t.rounds            ?? prev.rounds,
      matchEndCriterion: t.match_end_criterion ?? prev.matchEndCriterion,
      matchEndValue:     t.match_end_value   ?? prev.matchEndValue,
      warmUpTime:        t.warm_up_time      ?? prev.warmUpTime,
      price:             t.price_crc         ?? prev.price,
      prize:             t.prize_description ?? prev.prize,
    }));
    if (t.point_rules?.length > 0) {
      setPointRules(t.point_rules);
    }
  }, [location.state]);

  // Ajustar tabla de puntos cuando cambia el cupo (sin límite de posiciones)
  useEffect(() => {
    const newCount = Number(formData.playerLimit);
    setPointRules((prev) => {
      if (newCount === prev.length) return prev;
      if (newCount > prev.length) {
        const extra = Array.from(
          { length: newCount - prev.length },
          (_, i) => ({
            position: prev.length + i + 1,
            points:   defaultPointsForPosition(prev.length + i + 1),
          })
        );
        return [...prev, ...extra];
      }
      return prev.slice(0, newCount);
    });
  }, [formData.playerLimit]);

  // Código de categoría derivado de los niveles seleccionados (para display y DB)
  const categoryCode = useMemo(
    () => deriveCategoryCode(formData.selectedLevels),
    [formData.selectedLevels]
  );

  const estimatedMatchesPerRound = Math.floor(Number(formData.playerLimit) / 4);
  const totalEstimatedMatches =
    formData.format === "Reto"
      ? 1
      : estimatedMatchesPerRound * Number(formData.rounds);

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  // Guardar configuración actual como plantilla
  async function saveAsTemplate() {
    const name = window.prompt("Nombre para la plantilla (ej. \"Pozo Mexicano Viernes B\"):");
    if (!name?.trim()) return;
    if (formData.selectedLevels.length === 0) {
      setTemplateMsg("❌ Seleccioná al menos un nivel antes de guardar la plantilla.");
      return;
    }
    setSavingTemplate(true);
    setTemplateMsg("");
    const { error } = await supabase.from("event_templates").insert({
      name:                name.trim(),
      format:              formData.format.toLowerCase(),
      allowed_levels:      formData.selectedLevels,
      gender_filter:       formData.genderFilter,
      pair_format:         formData.pairFormat,
      location:            formData.location.trim() || null,
      player_limit:        Number(formData.playerLimit),
      courts:              Number(formData.courts),
      rounds:              Number(formData.rounds),
      match_end_criterion: formData.matchEndCriterion,
      match_end_value:     Number(formData.matchEndValue),
      warm_up_time:        Number(formData.warmUpTime),
      price_crc:           Number(formData.price),
      prize_description:   formData.prize.trim() || null,
      point_rules:         pointRules.filter((r) => r.points > 0),
      created_by:          user.id,
    });
    if (error) setTemplateMsg("❌ " + error.message);
    else       setTemplateMsg("✅ Plantilla guardada.");
    setSavingTemplate(false);
  }

  // Toggle nivel individual
  function toggleLevel(level) {
    setFormData((prev) => {
      const has = prev.selectedLevels.includes(level);
      // No permitir dejar 0 niveles
      if (has && prev.selectedLevels.length === 1) return prev;
      return {
        ...prev,
        selectedLevels: has
          ? prev.selectedLevels.filter((l) => l !== level)
          : [...prev.selectedLevels, level],
      };
    });
  }

  // Toggle categoría completa (seleccionar/deseleccionar todos sus niveles)
  function toggleCategoryLevels(levels) {
    setFormData((prev) => {
      const allSelected = levels.every((l) => prev.selectedLevels.includes(l));
      if (allSelected) {
        const remaining = prev.selectedLevels.filter((l) => !levels.includes(l));
        // No dejar vacío
        return { ...prev, selectedLevels: remaining.length > 0 ? remaining : prev.selectedLevels };
      }
      const merged = [...new Set([...prev.selectedLevels, ...levels])];
      return { ...prev, selectedLevels: merged };
    });
  }

  function handlePointRuleChange(index, newPoints) {
    setPointRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, points: Math.max(0, Number(newPoints)) } : r))
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    if (!formData.title.trim()) {
      setSaveError("El nombre del evento es obligatorio.");
      return;
    }
    if (!formData.date) {
      setSaveError("La fecha es obligatoria.");
      return;
    }
    if (formData.selectedLevels.length === 0) {
      setSaveError("Seleccioná al menos un nivel para el evento.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      // 1. Temporada activa
      const { data: season, error: seasonErr } = await supabase
        .from("seasons").select("id").eq("is_active", true).maybeSingle();
      if (seasonErr) throw seasonErr;
      if (!season) throw new Error("No hay temporada activa. Creá una en el panel de Supabase.");

      // 2. Timestamp de inicio
      const starts_at = combineDateTime(formData.date, formData.time);

      // 3. Insertar evento (columnas del schema 0001 + location de 0003)
      const { data: newEvent, error: eventErr } = await supabase
        .from("events")
        .insert({
          season_id:           season.id,
          created_by:          user.id,
          title:               formData.title.trim(),
          format:              formData.format.toLowerCase(),
          category_code:       categoryCode,
          allowed_levels:      formData.selectedLevels,
          gender_filter:       formData.genderFilter,
          pair_format:         formData.pairFormat,
          starts_at,
          location:            formData.location.trim() || null,
          player_limit:        Number(formData.playerLimit),
          courts:              Number(formData.courts),
          rounds:              formData.format === "Reto" ? 1 : Number(formData.rounds),
          match_end_criterion: formData.matchEndCriterion,
          match_end_value:     Number(formData.matchEndValue),
          warm_up_time:        Number(formData.warmUpTime),
          price_crc:           Number(formData.price),
          prize_description:   formData.prize.trim() || null,
          status:              "open",
        })
        .select().single();
      if (eventErr) throw eventErr;

      // 5. Reglas de puntos configuradas por el admin
      const rules = pointRules
        .filter((r) => r.points > 0)
        .map((r) => ({ event_id: newEvent.id, position: r.position, points: r.points }));

      if (rules.length > 0) {
        const { error: rulesErr } = await supabase.from("event_point_rules").insert(rules);
        if (rulesErr) console.warn("No se pudieron crear las reglas de puntos:", rulesErr.message);
      }

      // 6. Navegar al coordinador
      navigate(`/admin/evento/${newEvent.id}`);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <main className="section create-event-page">
      <div className="container">
        <Link className="back-link" to="/admin">← Volver al admin</Link>

        <section className="create-event-hero card">
          <div>
            <p className="section-kicker">Nuevo evento</p>
            <h1 className="section-title">Crear evento Padel Nation</h1>
            <p className="section-description">
              Configurá el formato, categoría, cupos, canchas, criterio de
              partido y puntos por posición. Se guardará en la base de datos.
            </p>
          </div>
          <div className="create-event-format-card">
            <span>Formato seleccionado</span>
            <strong>{formData.format}</strong>
            <small>Categoría {categoryCode}</small>
          </div>
        </section>

        <section className="create-event-layout">
          <form className="card create-event-form" onSubmit={handleSubmit}>

            {/* ── 1. Información general ── */}
            <div className="form-section">
              <div>
                <p className="section-kicker">Información general</p>
                <h2>Datos del evento</h2>
              </div>
              <div className="form-grid">
                <label className="form-field form-field-wide">
                  <span>Nombre del evento *</span>
                  <input type="text" name="title" value={formData.title}
                    onChange={handleChange} placeholder="Ej. Pozo Mexicano Categoría B" required />
                </label>

                <label className="form-field">
                  <span>Formato</span>
                  <select name="format" value={formData.format} onChange={handleChange}>
                    {EVENT_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>

                <div className="form-field form-field-wide">
                  <span>Niveles permitidos *</span>
                  <div className="level-selector">
                    {LEVELS_BY_CAT.map(({ cat, levels }) => {
                      const allActive = levels.every((l) => formData.selectedLevels.includes(l));
                      return (
                        <div key={cat} className="level-cat-row">
                          <button
                            type="button"
                            className={`level-cat-btn${allActive ? " active" : ""}`}
                            onClick={() => toggleCategoryLevels(levels)}
                            title={allActive ? `Deseleccionar ${cat}` : `Seleccionar todos de ${cat}`}
                          >
                            {cat}
                          </button>
                          {levels.map((level) => (
                            <button
                              key={level}
                              type="button"
                              className={`level-pill${formData.selectedLevels.includes(level) ? " active" : ""}`}
                              onClick={() => toggleLevel(level)}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                  <small className="level-hint">
                    Seleccionados: <strong>{formData.selectedLevels.join(", ") || "ninguno"}</strong>
                    {" · "}Categoría: <strong>{categoryCode}</strong>
                  </small>
                </div>

                <label className="form-field">
                  <span>Género</span>
                  <select name="genderFilter" value={formData.genderFilter} onChange={handleChange}>
                    <option value="any">Sin restricción</option>
                    <option value="male">Masculino</option>
                    <option value="female">Femenino</option>
                    <option value="mixed">Mixto (M + F)</option>
                  </select>
                </label>

                <div className="form-field pair-format-toggle">
                  <span>Evento de parejas fijas</span>
                  <label className="pair-format-switch">
                    <input
                      type="checkbox"
                      checked={formData.pairFormat}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, pairFormat: e.target.checked }))
                      }
                    />
                    <span className="pair-format-slider" />
                    <span className="pair-format-label">
                      {formData.pairFormat
                        ? `Sí — ${Math.floor(Number(formData.playerLimit) / 2)} parejas`
                        : "No"}
                    </span>
                  </label>
                  {formData.pairFormat && (
                    <small className="level-hint">
                      Los jugadores se inscriben en pareja. Cada pareja debe confirmar
                      antes de que el coordinador pueda generar rondas.
                      {formData.genderFilter === "mixed" && (
                        <> <strong>Mixto:</strong> cada pareja debe ser un hombre + una mujer.</>
                      )}
                    </small>
                  )}
                </div>

                <label className="form-field">
                  <span>Fecha *</span>
                  <input type="date" name="date" value={formData.date}
                    onChange={handleChange} required />
                </label>

                <label className="form-field">
                  <span>Hora</span>
                  <input type="time" name="time" value={formData.time} onChange={handleChange} />
                </label>

                <label className="form-field form-field-wide">
                  <span>Ubicación</span>
                  <input type="text" name="location" value={formData.location}
                    onChange={handleChange} placeholder="Ej. Padel Club Escazú" />
                </label>
              </div>
            </div>

            {/* ── 2. Configuración deportiva ── */}
            <div className="form-section">
              <div>
                <p className="section-kicker">Configuración deportiva</p>
                <h2>Jugadores y partidos</h2>
              </div>
              <div className="form-grid">
                <label className="form-field">
                  <span>Cupo de jugadores</span>
                  <input type="number" min="4" step="4" name="playerLimit"
                    value={formData.playerLimit} onChange={handleChange} />
                </label>

                <label className="form-field">
                  <span>Cantidad de canchas</span>
                  <input type="number" min="1" name="courts"
                    value={formData.courts} onChange={handleChange} />
                </label>

                <label className="form-field">
                  <span>Rondas</span>
                  <input type="number" min="1" name="rounds"
                    value={formData.rounds} onChange={handleChange}
                    disabled={formData.format === "Reto"} />
                </label>

                {/* 2.2 — Criterio de fin de partido */}
                <label className="form-field">
                  <span>Criterio de fin de partido</span>
                  <select
                    name="matchEndCriterion"
                    value={formData.matchEndCriterion}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        matchEndCriterion: val,
                        matchEndValue: val === "points" ? 24 : val === "time" ? 15 : prev.matchEndValue,
                      }));
                    }}
                  >
                    <option value="time">Tiempo (minutos)</option>
                    <option value="points">Puntos totales</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>{CRITERION_LABELS[formData.matchEndCriterion]}</span>
                  <input type="number" min="1" name="matchEndValue"
                    value={formData.matchEndValue} onChange={handleChange} />
                </label>

                <label className="form-field">
                  <span>Calentamiento previo (min)</span>
                  <input type="number" min="0" max="60" name="warmUpTime"
                    value={formData.warmUpTime} onChange={handleChange} />
                </label>
              </div>

              <div className="criterion-hint">
                <strong>{formData.matchEndCriterion === "time" ? "⏱ Tiempo" : "🏆 Puntos totales"}</strong>
                <p>{CRITERION_HINTS[formData.matchEndCriterion]}</p>
              </div>

              <div className="format-explanation">
                <strong>{formData.format}</strong>
                <p>{FORMAT_DESCRIPTIONS[formData.format]}</p>
              </div>
            </div>

            {/* ── 3. Puntos por posición (2.6) ── */}
            <div className="form-section">
              <div>
                <p className="section-kicker">Ranking</p>
                <h2>Puntos por posición</h2>
              </div>

              <p className="form-hint">
                Puntos de ranking que recibirá cada jugador según su posición final.
                Ajustá los valores según el nivel de competencia del evento.
                Las posiciones fuera de esta tabla reciben <strong>0 puntos</strong>.
              </p>

              <div className="points-table">
                {pointRules.map((rule, index) => (
                  <div className="points-row" key={rule.position}>
                    <span className={`points-pos-badge ${rule.position <= 3 ? `pos-top-${rule.position}` : ""}`}>
                      #{rule.position}
                    </span>
                    <input
                      className="points-input"
                      type="number"
                      min="0"
                      value={rule.points}
                      onChange={(e) => handlePointRuleChange(index, e.target.value)}
                    />
                    <span className="points-unit">pts</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 4. Comercial ── */}
            <div className="form-section">
              <div>
                <p className="section-kicker">Comercial</p>
                <h2>Precio y premio</h2>
              </div>
              <div className="form-grid">
                <label className="form-field">
                  <span>Precio inscripción ₡</span>
                  <input type="number" min="0" name="price"
                    value={formData.price} onChange={handleChange} />
                </label>

                <label className="form-field form-field-wide">
                  <span>Premio o descripción</span>
                  <textarea name="prize" rows="3" value={formData.prize}
                    onChange={handleChange} placeholder="Ej. Premio para el primer lugar" />
                </label>
              </div>
            </div>

            {saveError   && <p className="auth-error"   role="alert">{saveError}</p>}
            {templateMsg && <p className={`template-msg ${templateMsg.startsWith("✅") ? "template-msg-ok" : "template-msg-err"}`}>{templateMsg}</p>}

            <div className="form-actions">
              <Link className="btn btn-secondary" to="/admin">Cancelar</Link>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={saveAsTemplate}
                disabled={savingTemplate}
                title="Guardá esta configuración para reutilizarla en futuros eventos"
              >
                {savingTemplate ? "Guardando…" : "Guardar como plantilla"}
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Crear evento"}
              </button>
            </div>
          </form>

          {/* ── Sidebar preview ── */}
          <aside className="create-event-sidebar">
            <article className="card event-preview-card">
              <div className="event-preview-top">
                <span className="badge">{formData.format}</span>
                <span className="preview-status">Abierto</span>
              </div>

              <div className="preview-category">
                <span>Categoría</span>
                <strong>{categoryCode}</strong>
                {formData.genderFilter !== "any" && (
                  <small className={`preview-gender-badge gender-${formData.genderFilter}`}>
                    {{ male: "Masculino", female: "Femenino", mixed: "Mixto" }[formData.genderFilter]}
                  </small>
                )}
              </div>

              <h2>{formData.title || "Nombre del evento"}</h2>

              <div className="preview-info">
                <div>
                  <span>Fecha</span>
                  <strong>{formData.date ? formatDateDisplay(formData.date) : "Sin fecha"}</strong>
                </div>
                <div>
                  <span>Hora</span>
                  <strong>{formData.time || "—"}</strong>
                </div>
                <div>
                  <span>Ubicación</span>
                  <strong>{formData.location || "—"}</strong>
                </div>
                <div>
                  <span>Fin de partido</span>
                  <strong>
                    {formData.matchEndValue}{" "}
                    {formData.matchEndCriterion === "time" ? "min" : "pts totales"}
                  </strong>
                </div>
                {Number(formData.warmUpTime) > 0 && (
                  <div>
                    <span>Calentamiento</span>
                    <strong>{formData.warmUpTime} min</strong>
                  </div>
                )}
                <div>
                  <span>Precio</span>
                  <strong>₡{Number(formData.price).toLocaleString("es-CR")}</strong>
                </div>
              </div>

              <div className="preview-levels">
                <span>Niveles permitidos</span>
                <div>
                  {formData.selectedLevels.map((level) => <strong key={level}>{level}</strong>)}
                </div>
              </div>
            </article>

            <article className="card event-calculation-card">
              <p className="section-kicker">Estimación</p>
              <h2>Resumen operativo</h2>

              <div className="calculation-list">
                <div>
                  <span>Jugadores</span>
                  <strong>{formData.playerLimit}</strong>
                </div>
                <div>
                  <span>Canchas</span>
                  <strong>{formData.courts}</strong>
                </div>
                <div>
                  <span>Partidos por ronda</span>
                  <strong>{estimatedMatchesPerRound}</strong>
                </div>
                <div>
                  <span>Partidos estimados</span>
                  <strong>{totalEstimatedMatches}</strong>
                </div>
                {formData.matchEndCriterion === "time" && (() => {
                  const playingMins  = Number(formData.rounds) * Number(formData.matchEndValue);
                  const warmUp       = Number(formData.warmUpTime);
                  const totalMins    = playingMins + warmUp;
                  return (
                    <>
                      <div>
                        <span>Duración partidos</span>
                        <strong>{playingMins} min</strong>
                      </div>
                      {warmUp > 0 && (
                        <div>
                          <span>Calentamiento</span>
                          <strong>{warmUp} min</strong>
                        </div>
                      )}
                      <div className="calculation-total">
                        <span>⏱ Tiempo total</span>
                        <strong>{totalMins} min</strong>
                      </div>
                    </>
                  );
                })()}
                <div>
                  <span>Posiciones con puntos</span>
                  <strong>{pointRules.filter((r) => r.points > 0).length} / {pointRules.length}</strong>
                </div>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </main>
  );
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "Sin fecha";
  const d = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat("es-CR", {
    day: "numeric", month: "long", year: "numeric",
  }).format(d);
}

export default CreateEvent;
