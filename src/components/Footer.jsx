import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="brand">
            <span className="brand-mark">PN</span>
            <span className="brand-text">
              <strong>Padel Nation</strong>
              <small>CR</small>
            </span>
          </Link>

          <p>
            Plataforma para coordinar eventos, rankings y comunidad competitiva
            de pádel en Costa Rica.
          </p>
        </div>

        <div className="footer-column">
          <h3>Plataforma</h3>
          <Link to="/eventos">Eventos</Link>
          <Link to="/ranking">Ranking</Link>
          <Link to="/perfil">Mi perfil</Link>
        </div>

        <div className="footer-column">
          <h3>Formatos</h3>
          <a href="/#how-it-works">Mexicano</a>
          <a href="/#how-it-works">Americano</a>
          <span>Retos</span>
          <span>Torneos</span>
        </div>

        <div className="footer-column">
          <h3>Contacto</h3>
          <a
            href="https://wa.me/50600000000"
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
          <a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
          <span>padelnationcr.com</span>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© 2026 Padel Nation CR. Todos los derechos reservados.</span>
        <span>Eventos · Ranking · Comunidad</span>
      </div>
    </footer>
  );
}

export default Footer;