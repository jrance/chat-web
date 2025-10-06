import { Link, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Admin from "./pages/Admin";
import Chat from "./pages/Chat";
import AgentBuilder from "./pages/AgentBuilder";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Chat Web</h1>
        <nav className="app-nav">
          <Link to="/">Home</Link>
          <Link to="/admin">Admin</Link>
        </nav>
      </header>
      <main className="app-main">
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/agent-builder" element={<AgentBuilder />} />
            <Route path="/chat/:sessionId" element={<Chat />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
