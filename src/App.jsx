import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import GameList from "./pages/GameList";
import Scorekeeper from "./pages/Scorekeeper";
import ViewGame from "./pages/ViewGame";
import Login from "./pages/Login";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null; // wait for session hydration
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><GameList /></PrivateRoute>} />
      <Route path="/games/:id/score" element={<PrivateRoute><Scorekeeper /></PrivateRoute>} />
      {/* Live view is intentionally public — UUID is the share token */}
      <Route path="/games/:id/view" element={<ViewGame />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
