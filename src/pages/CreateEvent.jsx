import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./CreateEvent.css";

const eventFormats = ["Mexicano", "Americano", "Reto", "Torneo"];
const eventCategories = ["AA", "A", "B", "C", "D"];

const categoryLevels = {
  AA: ["AA"],
  A: ["A+", "A", "A-"],
  B: ["B+", "B", "B-"],
  C: ["C+", "C", "C-"],
  D: ["D+", "D", "D-"],
};

const formatDescriptions = {
  Mexicano:
    "La primera ronda se genera al azar. Después, las siguientes rondas se organizan según el puntaje acumulado de cada jugador.",
  Americano:
    "El calendario se genera desde el inicio como rotación todos contra todos, sin reorganizar por puntaje entre rondas.",
  Reto:
    "Se configura un enfrentamiento directo entre jugadores o parejas. El resultado puede impactar el ranking de forma puntual.",
  Torneo:
    "Formato futuro para llaves, grupos, semifinales y final. Ideal para eventos competitivos más grandes.",
};

function CreateEvent() {
  const [formData, setFormData] = useState({
    title: "Pozo Mexicano Categoría B",
    format: "Mexicano",
    category: "B",
    date: "2026-05-10",
    time: "19:00",
    location: "Padel Club Escazú",
    playerLimit: 16,
    courts: 4,
    rounds: 4,
    matchDuration: 15,
    price: 8000,
    prize: "Premio para el primer lugar",
    status: "Abierto",
  });

  const allowedLevels = useMemo(() => {
    return categoryLevels[formData.category] || [];
  }, [formData.category]);

  const estimatedMatchesPerRound = Math.floor(
    Number(formData.playerLimit) / 4
  );

  const totalEstimatedMatches =
    formData.format === "Reto"
      ? 1
      : estimatedMatchesPerRound * Number(formData.rounds);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    alert(
      "Mockup: el evento se creó visualmente. En la versión real se guardará en la base de datos."
    );
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
              principales del evento. Esta pantalla luego se conectará a la base
              de datos real.
            </p>
          </div>

          <div className="create-event-format-card">
            <span>Formato seleccionado</span>
            <strong>{formData.format}</strong>
            <small>{formData.category}</small>
          </div>
        </section>

        <section className="create-event-layout">
          <form className="card create-event-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <div>
                <p className="section-kicker">Información general</p>
                <h2>Datos del evento</h2>
              </div>

              <div className="form-grid">
                <label className="form-field form-field-wide">
                  <span>Nombre del evento</span>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                  />
                </label>

                <label className="form-field">
                  <span>Formato</span>
                  <select
                    name="format"
                    value={formData.format}
                    onChange={handleChange}
                  >
                    {eventFormats.map((format) => (
                      <option key={format} value={format}>
                        {format}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Categoría</span>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  >
                    {eventCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Fecha</span>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
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
                  />
                </label>
              </div>
            </div>

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
                  <span>Duración por partido</span>
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
                <p>{formatDescriptions[formData.format]}</p>
              </div>
            </div>

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

                <label className="form-field">
                  <span>Estado</span>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                  >
                    <option value="Abierto">Abierto</option>
                    <option value="Casi lleno">Casi lleno</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="Finalizado">Finalizado</option>
                  </select>
                </label>

                <label className="form-field form-field-wide">
                  <span>Premio o descripción</span>
                  <textarea
                    name="prize"
                    rows="4"
                    value={formData.prize}
                    onChange={handleChange}
                  />
                </label>
              </div>
            </div>

            <div className="form-actions">
              <Link className="btn btn-secondary" to="/admin">
                Cancelar
              </Link>
              <button className="btn btn-primary" type="submit">
                Crear evento
              </button>
            </div>
          </form>

          <aside className="create-event-sidebar">
            <article className="card event-preview-card">
              <div className="event-preview-top">
                <span className="badge">{formData.format}</span>
                <span className="preview-status">{formData.status}</span>
              </div>

              <div className="preview-category">
                <span>Categoría</span>
                <strong>{formData.category}</strong>
              </div>

              <h2>{formData.title}</h2>

              <div className="preview-info">
                <div>
                  <span>Fecha</span>
                  <strong>{formatDate(formData.date)}</strong>
                </div>
                <div>
                  <span>Hora</span>
                  <strong>{formData.time}</strong>
                </div>
                <div>
                  <span>Ubicación</span>
                  <strong>{formData.location}</strong>
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

function formatDate(dateValue) {
  if (!dateValue) return "Sin fecha";

  const date = new Date(`${dateValue}T00:00:00`);

  return new Intl.DateTimeFormat("es-CR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default CreateEvent;