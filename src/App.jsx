import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Events from "./pages/Events";
import Ranking from "./pages/Ranking";
import PlayerProfile from "./pages/PlayerProfile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/AdminDashboard";
import EventCoordinator from "./pages/EventCoordinator";
import CreateEvent from "./pages/CreateEvent";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
import EventHistory from "./pages/EventHistory";
import AdminPlayers from "./pages/AdminPlayers";
import AdminAuthorizations from "./pages/AdminAuthorizations";
import AdminExclusions from "./pages/AdminExclusions";
import AdminAudit from "./pages/AdminAudit";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <div className="page">
            <Navbar />

            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/eventos" element={<Events />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Register />} />
              <Route path="/historial" element={<EventHistory />} />
              <Route path="/no-autorizado" element={<Unauthorized />} />

              <Route
                path="/perfil"
                element={
                  <ProtectedRoute>
                    <PlayerProfile />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/evento/:id"
                element={
                  <ProtectedRoute allowedRoles={["admin", "super_admin", "coordinator"]}>
                    <EventCoordinator />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/crear-evento"
                element={
                  <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                    <CreateEvent />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/jugadores"
                element={
                  <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                    <AdminPlayers />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/autorizaciones"
                element={
                  <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                    <AdminAuthorizations />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin/exclusiones"
                element={
                  <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                    <AdminExclusions />
                  </ProtectedRoute>
                }
              />

            <Route
                path="/admin/auditoria"
                element={
                  <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                    <AdminAudit />
                  </ProtectedRoute>
                }
              />

              {/* Catch-all — debe ir al final */}
              <Route path="*" element={<NotFound />} />
            </Routes>

            <Footer />
          </div>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
