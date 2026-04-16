import { BrowserRouter, Routes, Route } from "react-router-dom";
import GameList from "./pages/GameList";
import Scorekeeper from "./pages/Scorekeeper";
import ViewGame from "./pages/ViewGame";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GameList />} />
        <Route path="/games/:id/score" element={<Scorekeeper />} />
        <Route path="/games/:id/view" element={<ViewGame />} />
      </Routes>
    </BrowserRouter>
  );
}
