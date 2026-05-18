import { Link } from "react-router-dom";
import "./NotFound.css";

function NotFound() {
  return (
    <main className="notfound-page section">
      <div className="container">
        <div className="notfound-content">
          <span className="notfound-code">404</span>
          <p className="section-kicker">Página no encontrada</p>
          <h1 className="section-title">Esta página no existe.</h1>
          <p className="section-description">
            La URL que ingresaste no corresponde a ninguna sección de Padel Nation CR.
          </p>
          <div className="notfound-actions">
            <Link className="btn btn-primary" to="/">
              Volver al inicio
            </Link>
            <Link className="btn btn-secondary" to="/eventos">
              Ver eventos
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default NotFound;
