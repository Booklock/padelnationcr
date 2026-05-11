import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Login.css";
import "./Register.css";

function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (formData.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUp(
      formData.email,
      formData.password,
      formData.fullName
    );

    if (signUpError) {
      setError(mapSignUpError(signUpError.message));
      setLoading(false);
      return;
    }

    setEmailSent(true);
  }

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

  return (
    <main className="auth-page section">
      <div className="container">
        <div className="auth-card card">
          <div className="auth-header">
            <p className="section-kicker">Nuevo jugador</p>
            <h1 className="auth-title">Creá tu cuenta</h1>
            <p className="auth-subtitle">
              Las cuentas creadas acá son de jugador. Los administradores son
              asignados por el equipo de Padel Nation.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>Nombre completo</span>
              <input
                type="text"
                name="fullName"
                placeholder="Tu nombre y apellido"
                value={formData.fullName}
                onChange={handleChange}
                required
                autoComplete="name"
              />
            </label>

            <label className="form-field">
              <span>Correo electrónico</span>
              <input
                type="email"
                name="email"
                placeholder="tu@correo.com"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </label>

            <label className="form-field">
              <span>Contraseña (mín. 8 caracteres)</span>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </label>

            <label className="form-field">
              <span>Confirmar contraseña</span>
              <input
                type="password"
                name="confirmPassword"
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={loading}
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </form>

          <div className="auth-footer">
            <span>¿Ya tenés cuenta?</span>
            <Link to="/login" className="auth-link">
              Ingresá acá
            </Link>
          </div>
        </div>
      </div>
    </main>
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
