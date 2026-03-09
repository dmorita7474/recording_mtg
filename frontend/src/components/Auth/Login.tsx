import { useState } from "react";
import { signIn } from "aws-amplify/auth";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn({ username: email, password });
      onLogin();
    } catch (err) {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          padding: "2rem",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px",
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#333" }}>
          議事録生成アプリ
        </h1>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <input
            type="email"
            placeholder="メールアドレス"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: "0.75rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "1rem",
            }}
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              padding: "0.75rem",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "1rem",
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "0.75rem",
              backgroundColor: "#0066cc",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "1rem",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
          {error && (
            <p style={{ color: "#d32f2f", margin: 0, textAlign: "center" }}>{error}</p>
          )}
        </form>
      </div>
    </div>
  );
}
