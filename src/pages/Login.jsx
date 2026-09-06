import { useState } from "react";
import { authService } from "../services/authService";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email || !password) {
      alert("Enter email and password.");
      return;
    }

    try {
      setLoading(true);

      const user = await authService.login(email, password);

      onLogin(user);
    } catch (err) {
      alert(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(135deg,#4A0012,#7A0026)",
      }}
    >
      <div
  className="modal-box"
  style={{
    width: "100%",
    maxWidth: 500,
  }}
>
        <div style={{ textAlign: "center", marginBottom: 25 }}>
          <img
            src="/logo.png"
            alt="SR Vastra"
            style={{ width: 90 }}
          />
          <h1 style={{ marginTop: 12 }}>SR Vastra</h1>
          <p>Billing Login</p>
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginTop: 14 }}
        />

        <button
          className="save-btn"
          style={{ width: "100%", marginTop: 22 }}
          onClick={login}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </div>
    </main>
  );
}