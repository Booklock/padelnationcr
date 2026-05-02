import { Navigate } from "react-router-dom";
import { currentUser } from "../data/mockUser";

function ProtectedRoute({ children, allowedRoles = [] }) {
  const isLoggedIn = Boolean(currentUser);
  const hasPermission = allowedRoles.includes(currentUser?.role);

  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }

  if (!hasPermission) {
    return <Navigate to="/no-autorizado" replace />;
  }

  return children;
}

export default ProtectedRoute;