import { Component } from "react";
import "./ErrorBoundary.css";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="eb-page section">
          <div className="container">
            <div className="eb-content">
              <span className="eb-icon">⚠️</span>
              <p className="section-kicker">Error inesperado</p>
              <h1 className="section-title">Algo salió mal.</h1>
              <p className="section-description">
                Ocurrió un error en la aplicación. Podés intentar recargar
                la página o volver al inicio.
              </p>

              <div className="eb-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => window.location.reload()}
                >
                  Recargar página
                </button>
                <a className="btn btn-secondary" href="/">
                  Volver al inicio
                </a>
              </div>

              {this.state.error && (
                <details className="eb-details">
                  <summary>Detalles técnicos</summary>
                  <pre>{this.state.error.message}</pre>
                </details>
              )}
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
