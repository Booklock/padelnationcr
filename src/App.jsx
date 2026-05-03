import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Events from "./pages/Events";
import Ranking from "./pages/Ranking";
import PlayerProfile from "./pages/PlayerProfile";
import AdminDashboard from "./pages/AdminDashboard";
import EventCoordinator from "./pages/EventCoordinator";
import CreateEvent from "./pages/CreateEvent";
import Unauthorized from "./pages/Unauthorized";

function App() {
  return (
    <BrowserRouter>
      <div className="page">
        <Navbar />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/perfil" element={<PlayerProfile />} />
          <Route path="/no-autorizado" element={<Unauthorized />} />

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
              <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
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
        </Routes>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;