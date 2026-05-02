import { Link } from "react-router-dom";

function Unauthorized() {
  return (
    <main className="section">
      <div className="container">
        <p className="section-kicker">Acceso restringido</p>
        <h1 className="section-title">No tenés permiso para ver esta sección.</h1>
        <p className="section-description">
          Esta área está reservada para administradores de Padel Nation.
        </p>

        <div style={{ marginTop: "28px" }}>
          <Link className="btn btn-primary" to="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}

export default Unauthorized;