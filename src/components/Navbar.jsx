import { Link } from "react-router-dom";
import { currentUser } from "../data/mockUser";
import "./Navbar.css";

function Navbar() {
  const isAdmin = currentUser?.role === "admin";

  return (
    <header className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="brand">
          <span className="brand-mark">PN</span>
          <span className="brand-text">
            <strong>Padel Nation</strong>
            <small>CR</small>
          </span>
        </Link>

        <nav className="nav-links">
          <Link to="/eventos">Eventos</Link>
          <Link to="/ranking">Ranking</Link>
          <Link to="/perfil">Mi perfil</Link>
          <a href="/#how-it-works">Cómo funciona</a>

          {isAdmin && <Link to="/admin">Admin</Link>}
        </nav>

        <div className="nav-actions">
          <button className="btn btn-secondary">Ingresar</button>
          <button className="btn btn-primary">Registrarme</button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;