import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { api, setToken, getToken, clearToken } from "./api";
import AdminRequests from "./AdminRequests";
import AdminCenters from "./AdminCenters";
import MedicDashboard from "./MedicDashboard";
import Inbox from "./Inbox";
import MyCalendar from "./MyCalendar";

export default function App() {
  const [tab, setTab] = useState("register");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [me, setMe] = useState(null);

  const [reg, setReg] = useState({ username: "", email: "", password: "", passwordRecheck: "" });
  const [login, setLogin] = useState({ email: "", password: "" });

  useEffect(() => {
    const t = getToken();
    if (!t) return;
    api.me().then(setMe).catch(() => clearToken());
  }, []);

  const notify = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    if (reg.password !== reg.passwordRecheck) return notify("Passwords do not match", "error");
    setLoading(true);
    try {
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
    } finally { setLoading(false); }
  };

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
    } finally { setLoading(false); }
  };

  const logout = () => { clearToken(); setMe(null); notify("Logged out","success"); };

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#0f172a", display:"flex", flexDirection:"column" }}>
        {/* top nav */}
        <nav style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"#0b1220" }}>
          <Link to="/" style={{ color:"white", textDecoration:"none", fontWeight:700 }}>Emergency Scheduler</Link>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            {me?.global_role === "admin" && (
  <>
    <Link to="/admin/requests" style={{ color:"#93c5fd" }}>Admin: Requests</Link>
    <Link to="/admin/centers" style={{ color:"#93c5fd" }}>Admin: Centers</Link>
  </>
)}
            {me && (
              <>
                <span style={{ color:"#94a3b8" }}>{me.username} ({me.global_role}, {me.status})</span>
                <button onClick={logout} style={styles.secondaryBtn}>Logout</button>
              </>
            )}
            {me && <>
            <Link to="/my-calendar" style={{ color:"#93c5fd" }}>My Calendar</Link>
  <Link to="/centers" style={{ color:"#93c5fd" }}>Centers</Link>
  <Link to="/inbox" style={{ color:"#93c5fd" }}>Inbox</Link> 
</>}
          </div>
        </nav>

        {/* content */}
        <main style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <Card>
            <Routes>
              <Route path="/" element={
                <AuthScreen
                  me={me} tab={tab} setTab={setTab}
                  reg={reg} setReg={setReg}
                  login={login} setLogin={setLogin}
                  loading={loading}
                  submitRegister={submitRegister}
                  submitLogin={submitLogin}
                  notify={notify}
                />
              } />
              <Route path="/admin/requests" element={
                <AdminOnly me={me}><AdminRequests/></AdminOnly>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
              <Route path="/centers" element={ me ? <MedicDashboard me={me} /> : <Navigate to="/" replace /> } />
              <Route path="/inbox"   element={ me ? <Inbox me={me} />         : <Navigate to="/" replace /> } /> {/* NEW */}
              <Route path="/my-calendar" element={ me ? <MyCalendar /> : <Navigate to="/" replace /> } />
              <Route path="/admin/requests" element={<AdminOnly me={me}><AdminRequests/></AdminOnly>} />
              <Route path="/admin/centers"  element={<AdminOnly me={me}><AdminCenters/></AdminOnly>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {toast && (
              <div style={{ ...styles.toast, borderColor: toast.type === "error" ? "#e74c3c" : "#2ecc71" }}>
                {toast.msg}
              </div>
            )}
          </Card>
        </main>
      </div>
    </BrowserRouter>
  );
}

function AdminOnly({ me, children }) {
  if (!me) return <div style={{ padding: 8 }}>Please log in as admin.</div>;
  if (me.global_role !== "admin") return <div style={{ padding: 8 }}>Forbidden: admin only.</div>;
  if (me.status !== "approved") return <div style={{ padding: 8 }}>Admin account not approved yet.</div>;
  return children;
}

function AuthScreen({ me, tab, setTab, reg, setReg, login, setLogin, loading, submitRegister, submitLogin }) {
  return (
    <div style={{ width: 420 }}>
      <h1 style={{ margin: 0 }}>Emergency Scheduler</h1>
      <p style={{ marginTop: 4, opacity: 0.8 }}>Auth demo (Register + Login)</p>

      {me ? (
        <div style={styles.banner}>
          <b>Signed in as:</b>&nbsp;{me.username} &lt;{me.email}&gt; — role: {me.global_role} — status:&nbsp;
          <span style={{ color: me.status === "approved" ? "green" : "orange" }}>{me.status}</span>
        </div>
      ) : (
        <div style={styles.tabs}>
          <button onClick={() => setTab("register")} style={{ ...styles.tabBtn, ...(tab === "register" ? styles.tabActive : {}) }}>Register</button>
          <button onClick={() => setTab("login")} style={{ ...styles.tabBtn, ...(tab === "login" ? styles.tabActive : {}) }}>Login</button>
        </div>
      )}

      {!me && tab === "register" && (
        <form onSubmit={submitRegister} style={styles.form}>
          <label>Username</label>
          <input type="text" value={reg.username} onChange={(e) => setReg({ ...reg, username: e.target.value })} required />
          <label>Email</label>
          <input type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} required />
          <label>Password</label>
          <input type="password" value={reg.password} onChange={(e) => setReg({ ...reg, password: e.target.value })} required minLength={6} />
          <label>Retype Password</label>
          <input type="password" value={reg.passwordRecheck} onChange={(e) => setReg({ ...reg, passwordRecheck: e.target.value })} required minLength={6} />
          <button type="submit" disabled={loading} style={styles.primaryBtn}>{loading ? "Submitting..." : "Register"}</button>
        </form>
      )}

      {!me && tab === "login" && (
        <form onSubmit={submitLogin} style={styles.form}>
          <label>Email</label>
          <input type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} required />
          <label>Password</label>
          <input type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} required />
          <button type="submit" disabled={loading} style={styles.primaryBtn}>{loading ? "Logging in..." : "Login"}</button>
          <p style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Note: Non-approved users will be blocked by the backend.</p>
        </form>
      )}
    </div>
  );
}

function Card({ children }) {
  return <div style={styles.card}>{children}</div>;
}

const styles = {
  container: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a" },
  card: { width: 720, background: "white", borderRadius: 12, padding: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.2)" },
  tabs: { display: "flex", gap: 8, marginTop: 8, marginBottom: 8 },
  tabBtn: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer" },
  tabActive: { background: "#e2e8f0", borderColor: "#94a3b8" },
  form: { display: "grid", gap: 8, marginTop: 12 },
  primaryBtn: { marginTop: 8, padding: "10px 14px", border: 0, borderRadius: 8, background: "#2563eb", color: "white", cursor: "pointer" },
  secondaryBtn: { marginLeft: 12, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", cursor: "pointer" },
  banner: { marginTop: 12, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 10, display: "flex", alignItems: "center" },
  toast: { marginTop: 12, padding: 10, borderRadius: 8, border: "1px solid", background: "#fefefe" },
};
