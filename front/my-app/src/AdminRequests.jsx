// src/AdminRequests.jsx
import { useEffect, useState } from "react";
import { api } from "./api";

export default function AdminRequests() {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.adminPending();
      setPending(data.pending || []);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    setBusyId(id);
    try { await api.adminApprove(id); await load(); }
    catch (e) { alert(e.message); }
    finally { setBusyId(null); }
  };

  const reject = async (id) => {
    setBusyId(id);
    try { await api.adminReject(id); await load(); }
    catch (e) { alert(e.message); }
    finally { setBusyId(null); }
  };

  if (loading) return <div>Loading…</div>;
  if (err) return <div style={{color:"crimson"}}>Error: {err}</div>;

  return (
    <div>
      <h2>Pending Requests</h2>
      {pending.length === 0 ? (
        <p>No pending users 🎉</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Username</th>
              <th style={th}>Email</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {pending.map(p => (
              <tr key={p.id}>
                <td style={td}>{p.username}</td>
                <td style={td}>{p.email}</td>
                <td style={td}>
                  <button onClick={() => approve(p.id)} disabled={busyId===p.id} style={btnPrimary}>
                    {busyId===p.id ? "…" : "Approve"}
                  </button>
                  <button onClick={() => reject(p.id)} disabled={busyId===p.id} style={btnGhost}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th = { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "8px 6px", borderBottom: "1px solid #f1f5f9" };
const btnPrimary = { marginRight: 8, padding: "6px 10px", border: 0, borderRadius: 6, background: "#2563eb", color: "white", cursor: "pointer" };
const btnGhost   = { padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", cursor: "pointer" };
