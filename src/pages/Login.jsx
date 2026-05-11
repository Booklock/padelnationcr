import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Login.css";

function Login() {
  const { signIn, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: authError } = await signIn(formData.email, formData.password);

    if (authError) {
      setError(mapAuthError(authError.message));
      setLoading(false);
      return;
    }

    navigate(from, { replace: true });
  }

  async function handleReset(e) {
    e.preventDefault();
    const { error: resetError } = await resetPassword(resetEmail);
    if (resetError) {
      setResetMessage("No se pudo enviar el correo. Verificá el email.");
    } else {
      setResetMessage("¡Revisá tu bandeja! Te enviamos un link para restablecer tu contraseña.");
    }
  }

  return (
    <main className="auth-page section">
      <div className="container">
        <div className="auth-card card">
          <div className="auth-header">
            <p className="section-kicker">Bienvenido</p>
            <h1 className="auth-title">Ingresá a tu cuenta</h1>
            <p className="auth-subtitle">
              Accedé a tus eventos, ranking y perfil de Padel Nation CR.
            </p>
          </div>

          {!showReset ? (
            <form className="auth-form" onSubmit={handleSubmit}>
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
                <span>Contraseña</span>
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                />
              </label>

              {error && <p className="auth-error">{error}</p>}

              <button
                type="submit"
                className="btn btn-primary auth-submit"
                disabled={loading}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>

              <button
                type="button"
                className="auth-link-btn"
                onClick={() => setShowReset(true)}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleReset}>
              <p className="auth-subtitle">
                Ingresá tu email y te enviamos un link para restablecer tu contraseña.
              </p>

              <label className="form-field">
                <span>Correo electrónico</span>
                <input
                  type="email"
                  placeholder="tu@correo.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </label>

              {resetMessage && (
                <p className={resetMessage.includes("¡") ? "auth-success" : "auth-error"}>
                  {resetMessage}
                </p>
              )}

              <button type="submit" className="btn btn-primary auth-submit">
                Enviar link
              </button>

              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setShowReset(false);
                  setResetMessage("");
                }}
              >
                ← Volver al login
              </button>
            </form>
          )}

          <div className="auth-footer">
            <span>¿No tenés cuenta?</span>
            <Link to="/registro" className="auth-link">
              Registrate como jugador
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function mapAuthError(message) {
  if (message.includes("Invalid login credentials"))
    return "Email o contraseña incorrectos.";
  if (message.includes("Email not confirmed"))
    return "Confirmá tu email antes de ingresar. Revisá tu bandeja.";
  if (message.includes("Too many requests"))
    return "Demasiados intentos. Esperá unos minutos.";
  return "No se pudo ingresar. Intentá de nuevo.";
}

export default Login;
