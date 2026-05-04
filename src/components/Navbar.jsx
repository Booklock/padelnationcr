import { useState } from "react";
import { Link } from "react-router-dom";
import { currentUser } from "../data/mockUser";
import "./Navbar.css";

function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";

  function toggleMenu() {
    setIsMenuOpen((current) => !current);
  }

  function closeMenu() {
    setIsMenuOpen(false);
  }

  return (
    <header className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="brand" onClick={closeMenu}>
          <span className="brand-mark">PN</span>
          <span className="brand-text">
            <strong>Padel Nation</strong>
            <small>CR</small>
          </span>
        </Link>

        <nav className={isMenuOpen ? "nav-links open" : "nav-links"}>
          <Link to="/eventos" onClick={closeMenu}>
            Eventos
          </Link>
          <Link to="/ranking" onClick={closeMenu}>
            Ranking
          </Link>
          <Link to="/perfil" onClick={closeMenu}>
            Mi perfil
          </Link>
          <a href="/#how-it-works" onClick={closeMenu}>
            Cómo funciona
          </a>

          {isAdmin && (
            <Link to="/admin" onClick={closeMenu}>
              Admin
            </Link>
          )}

          <div className="mobile-nav-actions">
            <button className="btn btn-secondary">Ingresar</button>
            <button className="btn btn-primary">Registrarme</button>
          </div>
        </nav>

        <div className="nav-actions">
          <button className="btn btn-secondary">Ingresar</button>
          <button className="btn btn-primary">Registrarme</button>
        </div>

        <button
          className={isMenuOpen ? "menu-toggle open" : "menu-toggle"}
          onClick={toggleMenu}
          aria-label="Abrir menú"
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

export default Navbar;