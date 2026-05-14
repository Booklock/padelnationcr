import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./Navbar.css";

function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function toggleMenu() {
    setIsMenuOpen((current) => !current);
  }

  function closeMenu() {
    setIsMenuOpen(false);
  }

  async function handleSignOut() {
    closeMenu();
    await signOut();
    navigate("/login");
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
          <Link to="/historial" onClick={closeMenu}>
            Historial
          </Link>

          {user && (
            <Link to="/perfil" onClick={closeMenu}>
              Mi perfil
            </Link>
          )}

          <a href="/#how-it-works" onClick={closeMenu}>
            Cómo funciona
          </a>

          {isAdmin && (
            <Link to="/admin" onClick={closeMenu}>
              Admin
            </Link>
          )}

          <div className="mobile-nav-actions">
            {user ? (
              <>
                <span className="nav-user-name">
                  {profile?.full_name?.split(" ")[0] ?? "Jugador"}
                </span>
                <button className="btn btn-secondary" onClick={handleSignOut}>
                  Salir
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="btn btn-secondary"
                  onClick={closeMenu}
                >
                  Ingresar
                </Link>
                <Link
                  to="/registro"
                  className="btn btn-primary"
                  onClick={closeMenu}
                >
                  Registrarme
                </Link>
              </>
            )}
          </div>
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-user-name">
                {profile?.full_name?.split(" ")[0] ?? "Jugador"}
              </span>
              <button className="btn btn-secondary" onClick={handleSignOut}>
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary">
                Ingresar
              </Link>
              <Link to="/registro" className="btn btn-primary">
                Registrarme
              </Link>
            </>
          )}
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
