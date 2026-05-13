import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { combineDateTime } from "../utils/formatters";
import "./CreateEvent.css";

const EVENT_FORMATS    = ["Mexicano", "Americano", "Reto", "Torneo"];
const EVENT_CATEGORIES = ["AA", "A", "B", "C", "D"];

const CATEGORY_LEVELS = {
  AA: ["AA"],
  A:  ["A+", "A", "A-"],
  B:  ["B+", "B", "B-"],
  C:  ["C+", "C", "C-"],
  D:  ["D+", "D", "D-"],
};

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

/** Puntos por posición por defecto (hasta 8 posiciones, curva suave). */
function buildDefaultPointRules(eventId, positions) {
  const total  = Math.min(positions, 8);
  const scale  = [100, 80, 65, 52, 40, 30, 20, 10];
  const rules  = [];
  for (let pos = 1; pos <= total; pos++) {
    rules.push({ event_id: eventId, position: pos, points: scale[pos - 1] ?? 5 });
  }
  return rules;
}

function CreateEvent() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title:         "",
    format:        "Mexicano",
    category:      "B",
    date:          "",
    time:          "19:00",
    location:      "",
    playerLimit:   16,
    courts:        4,
    rounds:        4,
    matchDuration: 15,
    price:         0,
    prize:         "",
  });

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState(null);

  const allowedLevels = useMemo(
    () => CATEGORY_LEVELS[formData.category] ?? [],
    [formData.category]
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

    setSaving(true);
    setSaveError(null);

    try {
      // 1. Obtener temporada activa
      const { data: season, error: seasonErr } = await supabase
        .from("seasons")
        .select("id")
        .eq("is_active", true)
        .maybeSingle();

      if (seasonErr) throw seasonErr;
      if (!season) throw new Error("No hay temporada activa. Creá una en el panel de Supabase.");

      // 2. Buscar UUID de la categoría (opcional — no bloquea si no existe)
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .eq("code", formData.category)
        .maybeSingle();

      // 3. Construir timestamp de inicio
      const starts_at = combineDateTime(formData.date, formData.time);

      // 4. Insertar evento
      const { data: newEvent, error: eventErr } = await supabase
        .from("events")
        .insert({
          season_id:           season.id,
          title:               formData.title.trim(),
          format:              formData.format.toLowerCase(),
          category_id:         cat?.id ?? null,
          category_code:       formData.category,
          starts_at,
          location:            formData.location.trim() || null,
          player_limit:        Number(formData.playerLimit),
          courts:              Number(formData.courts),
          rounds_planned:      formData.format === "Reto" ? 1 : Number(formData.rounds),
          match_end_criterion: "time",
          match_end_value:     Number(formData.matchDuration),
          price:               Number(formData.price),
          description:         formData.prize.trim() || null,
          status:              "open",
        })
        .select()
        .single();

      if (eventErr) throw eventErr;

      // 5. Insertar reglas de puntos por defecto
      const rules = buildDefaultPointRules(newEvent.id, Number(formData.playerLimit));
      if (rules.length > 0) {
        const { error: rulesErr } = await supabase
          .from("event_point_rules")
          .insert(rules);
        if (rulesErr) console.warn("No se pudieron crear las reglas de puntos:", rulesErr.message);
      }

      // 6. Navegar al coordinador del nuevo evento
      navigate(`/admin/evento/${newEvent.id}`);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="section create-event-page">
      <div className="container">
        <Link className="back-link" to="/admin">
          ← Volver al admin
        </Link>

        <section className="create-event-hero card">
          <div>
            <p className="section-kicker">Nuevo evento</p>
            <h1 className="section-title">Crear evento Padel Nation</h1>
            <p className="section-description">
              Configurá el formato, categoría, cupos, canchas, rondas y detalles
              principales del evento. Se guardará directamente en la base de datos.
            </p>
          </div>

          <div className="create-event-format-card">
            <span>Formato seleccionado</span>
            <strong>{formData.format}</strong>
            <small>Categoría {formData.category}</small>
          </div>
        </section>

        <section className="create-event-layout">
          <form className="card create-event-form" onSubmit={handleSubmit}>

            {/* Información general */}
            <div className="form-section">
              <div>
                <p className="section-kicker">Información general</p>
                <h2>Datos del evento</h2>
              </div>

              <div className="form-grid">
                <label className="form-field form-field-wide">
                  <span>Nombre del evento *</span>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Ej. Pozo Mexicano Categoría B"
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Formato</span>
                  <select name="format" value={formData.format} onChange={handleChange}>
                    {EVENT_FORMATS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Categoría</span>
                  <select name="category" value={formData.category} onChange={handleChange}>
                    {EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Fecha *</span>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Hora</span>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                  />
                </label>

                <label className="form-field form-field-wide">
                  <span>Ubicación</span>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="Ej. Padel Club Escazú"
                  />
                </label>
              </div>
            </div>

            {/* Configuración deportiva */}
            <div className="form-section">
              <div>
                <p className="section-kicker">Configuración deportiva</p>
                <h2>Jugadores y partidos</h2>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Cupo de jugadores</span>
                  <input
                    type="number"
                    min="4"
                    step="4"
                    name="playerLimit"
                    value={formData.playerLimit}
                    onChange={handleChange}
                  />
                </label>

                <label className="form-field">
                  <span>Cantidad de canchas</span>
                  <input
                    type="number"
                    min="1"
                    name="courts"
                    value={formData.courts}
                    onChange={handleChange}
                  />
                </label>

                <label className="form-field">
                  <span>Rondas</span>
                  <input
                    type="number"
                    min="1"
                    name="rounds"
                    value={formData.rounds}
                    onChange={handleChange}
                    disabled={formData.format === "Reto"}
                  />
                </label>

                <label className="form-field">
                  <span>Duración por partido (min)</span>
                  <input
                    type="number"
                    min="5"
                    name="matchDuration"
                    value={formData.matchDuration}
                    onChange={handleChange}
                  />
                </label>
              </div>

              <div className="format-explanation">
                <strong>{formData.format}</strong>
                <p>{FORMAT_DESCRIPTIONS[formData.format]}</p>
              </div>
            </div>

            {/* Comercial */}
            <div className="form-section">
              <div>
                <p className="section-kicker">Comercial</p>
                <h2>Precio y premio</h2>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Precio inscripción ₡</span>
                  <input
                    type="number"
                    min="0"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                  />
                </label>

                <label className="form-field form-field-wide">
                  <span>Premio o descripción</span>
                  <textarea
                    name="prize"
                    rows="3"
                    value={formData.prize}
                    onChange={handleChange}
                    placeholder="Ej. Premio para el primer lugar"
                  />
                </label>
              </div>
            </div>

            {saveError && (
              <p className="auth-error" role="alert">{saveError}</p>
            )}

            <div className="form-actions">
              <Link className="btn btn-secondary" to="/admin">
                Cancelar
              </Link>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Guardando…" : "Crear evento"}
              </button>
            </div>
          </form>

          {/* Sidebar preview */}
          <aside className="create-event-sidebar">
            <article className="card event-preview-card">
              <div className="event-preview-top">
                <span className="badge">{formData.format}</span>
                <span className="preview-status">Abierto</span>
              </div>

              <div className="preview-category">
                <span>Categoría</span>
                <strong>{formData.category}</strong>
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
                  <span>Precio</span>
                  <strong>₡{Number(formData.price).toLocaleString("es-CR")}</strong>
                </div>
              </div>

              <div className="preview-levels">
                <span>Niveles permitidos</span>
                <div>
                  {allowedLevels.map((level) => (
                    <strong key={level}>{level}</strong>
                  ))}
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
                <div>
                  <span>Duración estimada</span>
                  <strong>
                    {Number(formData.rounds) * Number(formData.matchDuration)} min
                  </strong>
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
