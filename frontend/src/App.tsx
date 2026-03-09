import { useState, useEffect } from "react";
import { getCurrentUser } from "aws-amplify/auth";
import Login from "./components/Auth/Login";
import MeetingRoom from "./components/Meeting/MeetingRoom";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <p style={{ color: "#666" }}>読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return <MeetingRoom />;
}
