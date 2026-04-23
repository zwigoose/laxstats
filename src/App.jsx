import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import GameList from "./pages/GameList";
import Scorekeeper from "./pages/Scorekeeper";
import ViewGame from "./pages/ViewGame";
import Pressbox from "./pages/Pressbox";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import { version } from "../package.json";

// Single source of truth for footer height — consumed here and via the
// --footer-h CSS variable that full-viewport pages (Pressbox) use.
const FOOTER_H = 36;

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    // Pad the content area so nothing slides behind the fixed footer.
    <div style={{ paddingBottom: FOOTER_H }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<GameList />} />
        <Route path="/games/:id/score" element={<PrivateRoute><Scorekeeper /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
        <Route path="/games/:id/view" element={<ViewGame />} />
        <Route path="/games/:id/pressbox" element={<Pressbox />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Publish footer height as a CSS variable for full-viewport pages */}
        <style>{`:root { --footer-h: ${FOOTER_H}px; }`}</style>
        <AppRoutes />
        <footer style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: FOOTER_H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "#bbb",
          fontFamily: "system-ui, sans-serif",
          background: "#fff",
          borderTop: "1px solid #f0f0f0",
          zIndex: 100,
        }}>
          &copy; {new Date().getFullYear()} LaxStats &middot; v{version}
        </footer>
      </AuthProvider>
    </BrowserRouter>
  );
}
