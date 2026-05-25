import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Login.css";
import "./Register.css";

const CATEGORY_LEVELS = {
  AA: ["AA"],
  A:  ["A+", "A", "A-"],
  B:  ["B+", "B", "B-"],
  C:  ["C+", "C", "C-"],
  D:  ["D+", "D", "D-"],
};

const GENDER_OPTIONS = [
  { value: "",            label: "Seleccioná…" },
  { value: "male",        label: "Masculino" },
  { value: "female",      label: "Femenino" },
  { value: "unspecified", label: "Prefiero no decir" },
];

const SIDE_OPTIONS = [
  { value: "",      label: "Seleccioná…" },
  { value: "right", label: "Derecha" },
  { value: "left",  label: "Revés (izquierda)" },
  { value: "both",  label: "Ambos lados" },
];

function Register() {
  const { signUp } = useAuth();
  const navigate   = useNavigate();

  const [formData, setFormData] = useState({
    fullName:        "",
    nickname:        "",
    email:           "",
    password:        "",
    confirmPassword: "",
    category:        "",
    level:           "",
    phone:           "",
    gender:          "",
    preferredSide:   "",
  });

  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [emailSent,  setEmailSent]  = useState(false);

  // Niveles disponibles según la categoría elegida
  const availableLevels = useMemo(
    () => (formData.category ? CATEGORY_LEVELS[formData.category] ?? [] : []),
    [formData.category]
  );

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // Resetear nivel si cambia la categoría
      ...(name === "category" ? { level: "" } : {}),
    }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!validatePassword(formData.password)) {
      setError("La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.");
      return;
    }
    if (!formData.category) {
      setError("Seleccioná tu categoría de juego.");
      return;
    }
    if (!formData.level) {
      setError("Seleccioná tu nivel dentro de la categoría.");
      return;
    }
    if (!formData.phone.trim()) {
      setError("El teléfono / WhatsApp es obligatorio.");
      return;
    }
    if (!formData.gender) {
      setError("Seleccioná tu género.");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUp(formData.email, formData.password, {
      fullName:      formData.fullName,
      nickname:      formData.nickname.trim() || null,
      phone:         formData.phone,
      gender:        formData.gender,
      category:      formData.category,
      level:         formData.level,
      preferredSide: formData.preferredSide || null,
    });

    if (signUpError) {
      setError(mapSignUpError(signUpError.message));
      setLoading(false);
      return;
    }

    setEmailSent(true);
  }

  /* ── Email enviado ── */
  if (emailSent) {
    return (
      <main className="auth-page section">
        <div className="container">
          <div className="auth-card card">
            <div className="auth-header">
              <p className="section-kicker">Casi listo</p>
              <h1 className="auth-title">Confirmá tu email</h1>
              <p className="auth-subtitle">
                Te enviamos un correo a <strong>{formData.email}</strong>.
                Hacé click en el link para activar tu cuenta y después podés ingresar.
              </p>
            </div>
            <div className="register-success-note">
              Si no lo ves en unos minutos, revisá la carpeta de spam.
            </div>
            <Link to="/login" className="btn btn-primary auth-submit" style={{ textAlign: "center" }}>
              Ir al login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ── Formulario ── */
  return (
    <main className="auth-page section">
      <div className="container">
        <div className="auth-card register-card card">
          <div className="auth-header">
            <p className="section-kicker">Nuevo jugador</p>
            <h1 className="auth-title">Creá tu cuenta</h1>
            <p className="auth-subtitle">
              Completá tus datos para unirte a la comunidad Padel Nation CR.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>

            {/* ── Datos de cuenta ── */}
            <div className="register-section">
              <p className="register-section-label">Datos de cuenta</p>

              <label className="form-field">
                <span>Nombre completo *</span>
                <input
                  type="text" name="fullName"
                  placeholder="Tu nombre y apellido"
                  value={formData.fullName}
                  onChange={handleChange}
                  required autoComplete="name"
                />
              </label>

              <label className="form-field">
                <span>Correo electrónico *</span>
                <input
                  type="email" name="email"
                  placeholder="tu@correo.com"
                  value={formData.email}
                  onChange={handleChange}
                  required autoComplete="email"
                />
              </label>

              <label className="form-field">
                <span>Contraseña * (mín. 8 car., mayúscula, minúscula y número)</span>
                <input
                  type="password" name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required autoComplete="new-password"
                />
              </label>

              <label className="form-field">
                <span>Confirmar contraseña *</span>
                <input
                  type="password" name="confirmPassword"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required autoComplete="new-password"
                />
              </label>
            </div>

            {/* ── Nivel de juego ── */}
            <div className="register-section">
              <p className="register-section-label">Tu nivel de juego</p>
              <p className="register-section-hint">
                El admin puede ajustar tu categoría si es necesario. Elegí la que mejor te describe.
              </p>

              <div className="register-grid">
                <label className="form-field">
                  <span>Categoría *</span>
                  <select name="category" value={formData.category} onChange={handleChange} required>
                    <option value="">Seleccioná…</option>
                    {Object.keys(CATEGORY_LEVELS).map((cat) => (
                      <option key={cat} value={cat}>Categoría {cat}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Nivel *</span>
                  <select
                    name="level" value={formData.level}
                    onChange={handleChange}
                    required
                    disabled={!formData.category}
                  >
                    <option value="">
                      {formData.category ? "Seleccioná…" : "Primero elegí categoría"}
                    </option>
                    {availableLevels.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* ── Datos de contacto y perfil ── */}
            <div className="register-section">
              <p className="register-section-label">Datos de contacto y perfil</p>
              <p className="register-section-hint">
                El teléfono y género son necesarios para la organización de torneos por categoría.
              </p>

              <div className="register-grid">
                <label className="form-field">
                  <span>Teléfono / WhatsApp *</span>
                  <input
                    type="tel" name="phone"
                    placeholder="+506 8888 8888"
                    value={formData.phone}
                    onChange={handleChange}
                    autoComplete="tel"
                  />
                </label>

                <label className="form-field">
                  <span>Género *</span>
                  <select name="gender" value={formData.gender} onChange={handleChange} required>
                    {GENDER_OPTIONS.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Apodo / Nickname <span className="register-optional">(opcional)</span></span>
                  <input
                    type="text" name="nickname"
                    placeholder="Ej. Fabi, El Rayo…"
                    value={formData.nickname}
                    onChange={handleChange}
                    maxLength={30}
                  />
                </label>

                <label className="form-field">
                  <span>Lado preferido <span className="register-optional">(opcional)</span></span>
                  <select name="preferredSide" value={formData.preferredSide} onChange={handleChange}>
                    {SIDE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {error && <p className="auth-error">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
            >
              {loading ? "Creando cuenta…" : "Crear cuenta"}
            </button>
          </form>

          <div className="auth-footer">
            <span>¿Ya tenés cuenta?</span>
            <Link to="/login" className="auth-link">Ingresá acá</Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function validatePassword(password) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

function mapSignUpError(message) {
  if (message.includes("already registered") || message.includes("already been registered"))
    return "Ese correo ya está registrado. Intentá ingresar.";
  if (message.includes("Password should be at least"))
    return "La contraseña debe tener al menos 8 caracteres.";
  if (message.includes("Unable to validate email"))
    return "El correo no parece válido.";
  return "No se pudo crear la cuenta. Intentá de nuevo.";
}

export default Register;
