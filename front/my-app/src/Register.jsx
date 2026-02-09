import { useEffect, useState } from "react";
import { api, setToken, getToken, clearToken } from "./api";

export default function App() {
  const [tab, setTab] = useState("register"); // "register" | "login"
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [me, setMe] = useState(null);

  // forms
  const [reg, setReg] = useState({ username: "", email: "", password: "", passwordRecheck: "" });
  const [login, setLogin] = useState({ email: "", password: "" });

  useEffect(() => {
    // if a token exists, try loading /me
    const t = getToken();
    if (!t) return;
    api.me()
      .then(setMe)
      .catch(() => clearToken());
  }, []);

  const notify = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // --- Register ---
  const submitRegister = async (e) => {
    e.preventDefault();
    if (reg.password !== reg.passwordRecheck) {
      notify("Passwords do not match", "error");
      return;
    }
    setLoading(true);
    try {
      // send only required fields
      await api.register({
        username: reg.username.trim(),
        email: reg.email.trim(),
        password: reg.password,
        passwordRecheck: reg.passwordRecheck,
      });
      notify("Registered! Awaiting admin approval.", "success");
      setReg({ username: "", email: "", password: "", passwordRecheck: "" });
      setTab("login");
    } catch (err) {
      notify(err.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- Login ---
  const submitLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api.login(login.email.trim(), login.password);
      setToken(data.access_token);
      const meData = await api.me();
      setMe(meData);
      notify("Logged in!", "success");
    } catch (err) {
      notify(err.message || "Login failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearToken();
    setMe(null);
    notify("Logged out", "success");
  };

  return (
    <div style={styles.container}>
      <Card>
        <h1 style={{ margin: 0 }}>Emergency Scheduler</h1>
        <p style={{ marginTop: 4, opacity: 0.8 }}>Auth demo (Register + Login)</p>

        {/* auth status */}
        {me ? (
          <div style={styles.banner}>
            <b>Signed in as:</b> {me.username} &lt;{me.email}&gt; — role: {me.global_role} — status:{" "}
            <span style={{ color: me.status === "approved" ? "green" : "orange" }}>{me.status}</span>
            <button onClick={logout} style={styles.secondaryBtn}>Logout</button>
          </div>
        ) : (
          <div style={styles.tabs}>
            <button
              onClick={() => setTab("register")}
              style={{ ...styles.tabBtn, ...(tab === "register" ? styles.tabActive : {}) }}
            >
              Register
            </button>
            <button
              onClick={() => setTab("login")}
              style={{ ...styles.tabBtn, ...(tab === "login" ? styles.tabActive : {}) }}
            >
              Login
            </button>
          </div>
        )}

        {!me && tab === "register" && (
          <form onSubmit={submitRegister} style={styles.form}>
            <label>Username</label>
            <input
              type="text"
              value={reg.username}
              onChange={(e) => setReg({ ...reg, username: e.target.value })}
              required
            />

            <label>Email</label>
            <input
              type="email"
              value={reg.email}
              onChange={(e) => setReg({ ...reg, email: e.target.value })}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={reg.password}
              onChange={(e) => setReg({ ...reg, password: e.target.value })}
              required
              minLength={6}
            />

            <label>Retype Password</label>
            <input
              type="password"
              value={reg.passwordRecheck}
              onChange={(e) => setReg({ ...reg, passwordRecheck: e.target.value })}
              required
              minLength={6}
            />

            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? "Submitting..." : "Register"}
            </button>
          </form>
        )}

        {!me && tab === "login" && (
          <form onSubmit={submitLogin} style={styles.form}>
            <label>Email</label>
            <input
              type="email"
              value={login.email}
              onChange={(e) => setLogin({ ...login, email: e.target.value })}
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={login.password}
              onChange={(e) => setLogin({ ...login, password: e.target.value })}
              required
            />

            <button type="submit" disabled={loading} style={styles.primaryBtn}>
              {loading ? "Logging in..." : "Login"}
            </button>

            <p style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              Note: Non-approved users will be blocked by the backend.
            </p>
          </form>
        )}

        {toast && (
          <div
            style={{
              ...styles.toast,
              borderColor: toast.type === "error" ? "#e74c3c" : "#2ecc71",
            }}
          >
            {toast.msg}
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ children }) {
  return <div style={styles.card}>{children}</div>;
}

const styles = {
  container: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" },
  card: { width: 420, background: "white", borderRadius: 12, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" },
  tabs: { display: "flex", gap: 8, marginTop: 8, marginBottom: 8 },
  tabBtn: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" },
  tabActive: { background: "#e2e8f0", borderColor: "#94a3b8" },
  form: { display: "grid", gap: 8, marginTop: 12 },
  primaryBtn: { marginTop: 8, padding: "10px 14px", border: 0, borderRadius: 8, background: "#2563eb", color: "white", cursor: "pointer" },
  secondaryBtn: { marginLeft: 12, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", cursor: "pointer" },
  banner: { marginTop: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, display: "flex", alignItems: "center" },
  toast: { marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid", background: "#fefefe" },
};
