import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import GameList from "./pages/GameList";
import Scorekeeper from "./pages/Scorekeeper";
import ViewGame from "./pages/ViewGame";
import Pressbox from "./pages/Pressbox";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import { version } from "../package.json";

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
      <Route path="/" element={<GameList />} />
      <Route path="/games/:id/score" element={<PrivateRoute><Scorekeeper /></PrivateRoute>} />
      <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
      {/* Live view and press box are intentionally public — UUID is the share token */}
      <Route path="/games/:id/view" element={<ViewGame />} />
      <Route path="/games/:id/pressbox" element={<Pressbox />} />
    </Routes>
  );
}

function Footer() {
  return (
    <footer style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      textAlign: "center",
      padding: "6px 16px",
      fontSize: 11,
      color: "#bbb",
      fontFamily: "system-ui, sans-serif",
      pointerEvents: "none",
    }}>
      &copy; {new Date().getFullYear()} LaxStats &middot; v{version}
    </footer>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  );
}
