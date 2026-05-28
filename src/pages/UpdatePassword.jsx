import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import "./Login.css";

function validatePassword(p) {
  return (
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[0-9]/.test(p)
  );
}

export default function UpdatePassword() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);
  const [ready, setReady]         = useState(false); // sesión de recovery activa
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase lee el hash automáticamente y dispara PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") setReady(true);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!validatePassword(password)) {
      setError("Mínimo 8 caracteres, una mayúscula, una minúscula y un número.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/perfil"), 2500);
    }
  }

  return (
    <main className="auth-page section">
      <div className="container">
        <div className="auth-card card">
          <div className="auth-header">
            <p className="section-kicker">Seguridad</p>
            <h1 className="auth-title">Nueva contraseña</h1>
            <p className="auth-subtitle">
              Elegí una contraseña segura para tu cuenta.
            </p>
          </div>

          {success ? (
            <div className="auth-form">
              <p className="auth-success">
                ✓ Contraseña actualizada. Redirigiendo a tu perfil…
              </p>
            </div>
          ) : !ready ? (
            <div className="auth-form">
              <p className="auth-subtitle">
                Verificando enlace de recuperación…
              </p>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="form-field">
                <span>Nueva contraseña</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  required
                  autoComplete="new-password"
                />
              </label>

              <label className="form-field">
                <span>Confirmá la contraseña</span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
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
                {loading ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
