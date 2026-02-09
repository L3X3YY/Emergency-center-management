import { useEffect, useState } from "react";
import { api } from "./api";

export default function AdminCenters() {
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState([]);
  const [err, setErr] = useState(null);

  // create form
  const [newCenter, setNewCenter] = useState({ name: "", location: "" });

  // inline edit state
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({ name: "", location: "" });
  const [busyId, setBusyId] = useState(null);

  // lead cache: { [centerId]: { user_id, name, email } | null }
  const [leads, setLeads] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.centersList();
      const list = data.centers || [];
      setCenters(list);
      setErr(null);

      // fetch current lead per center (in parallel)
      const results = await Promise.all(
        list.map(async (c) => {
          try {
            const mem = await api.centerMembers(c._id);
            const lead = (mem.members || []).find((m) => m.role === "lead");
            return [c._id, lead || null];
          } catch {
            return [c._id, null];
          }
        })
      );
      const map = Object.fromEntries(results);
      setLeads(map);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createCenter = async (e) => {
    e.preventDefault();
    if (!newCenter.name.trim()) return alert("Name is required");
    try {
      setBusyId("create");
      await api.centerCreate({ name: newCenter.name.trim(), location: newCenter.location.trim() });
      setNewCenter({ name: "", location: "" });
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (c) => {
    setEditId(c._id);
    setEditData({ name: c.name, location: c.location || "" });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditData({ name: "", location: "" });
  };

  const saveEdit = async (id) => {
    if (!editData.name.trim()) return alert("Name is required");
    try {
      setBusyId(id);
      await api.centerUpdate(id, { name: editData.name.trim(), location: editData.location.trim() });
      setEditId(null);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const removeCenter = async (id) => {
    if (!confirm("Delete this center? This also removes memberships and shifts for it.")) return;
    try {
      setBusyId(id);
      await api.centerDelete(id);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  // Set/Change lead — accepts user_id or email
  const setLead = async (center) => {
    const input = prompt(
      `Set lead for "${center.name}".\n` +
      `Enter USER ID or EMAIL of the medic.\n\n` +
      `Tip: You can find user ids via Admin → Requests/Users.`
    );
    if (!input) return;

    let userId = input.trim();

    // resolve via email if needed
    if (userId.includes("@")) {
      try {
        const all = await api.adminUsers(); // {users:[{id, email, username, ...}]}
        const match = (all.users || []).find(u => u.email?.toLowerCase() === userId.toLowerCase());
        if (!match) return alert("No user found with that email.");
        userId = match.id;
      } catch (e) {
        return alert(e.message || "Could not resolve email to user id.");
      }
    }

    try {
      setBusyId(`lead-${center._id}`);
      await api.centerAssignLead(center._id, userId);
      // refresh just this center's lead
      const mem = await api.centerMembers(center._id);
      const lead = (mem.members || []).find((m) => m.role === "lead") || null;
      setLeads((prev) => ({ ...prev, [center._id]: lead }));
      alert("Lead updated.");
    } catch (e) {
      alert(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div>Loading centers…</div>;
  if (err) return <div style={{ color: "crimson" }}>Error: {err}</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Centers</h2>

      {/* Create */}
      <form onSubmit={createCenter} style={row}>
        <input
          placeholder="Center name"
          value={newCenter.name}
          onChange={(e) => setNewCenter({ ...newCenter, name: e.target.value })}
          style={input}
          required
        />
        <input
          placeholder="Location (optional)"
          value={newCenter.location}
          onChange={(e) => setNewCenter({ ...newCenter, location: e.target.value })}
          style={input}
        />
        <button type="submit" disabled={busyId === "create"} style={btnPrimary}>
          {busyId === "create" ? "Adding…" : "Add Center"}
        </button>
      </form>

      {/* List */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Location</th>
            <th style={th}>Lead</th> {/* NEW */}
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {centers.map((c) => {
            const lead = leads[c._id];
            return (
              <tr key={c._id}>
                <td style={td}>
                  {editId === c._id ? (
                    <input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      style={input}
                    />
                  ) : (
                    c.name
                  )}
                </td>
                <td style={td}>
                  {editId === c._id ? (
                    <input
                      value={editData.location}
                      onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                      style={input}
                    />
                  ) : (
                    c.location || "—"
                  )}
                </td>

                {/* Lead column */}
                <td style={td}>
                  {lead ? (
                    <div>
                      <div style={{ fontWeight: 600 }}>{lead.name || lead.email || lead.user_id}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>{lead.email || ""}</div>
                    </div>
                  ) : (
                    <span style={{ opacity: 0.7 }}>—</span>
                  )}
                </td>

                <td style={td}>
                  {editId === c._id ? (
                    <>
                      <button onClick={() => saveEdit(c._id)} disabled={busyId === c._id} style={btnPrimary}>
                        {busyId === c._id ? "Saving…" : "Save"}
                      </button>
                      <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(c)} style={btnGhost}>Update</button>
                      <button onClick={() => setLead(c)} disabled={busyId === `lead-${c._id}`} style={btnGhost}>
                        {busyId === `lead-${c._id}` ? "…" : (leads[c._id] ? "Change Lead" : "Set Lead")}
                      </button>
                      <button onClick={() => removeCenter(c._id)} disabled={busyId === c._id} style={btnDanger}>
                        {busyId === c._id ? "…" : "Delete"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {centers.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 12, opacity: 0.7 }}>No centers yet</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const row = { display: "flex", gap: 8, alignItems: "center" };
const input = { padding: "8px 10px", border: "1px solid #e2e8f0", borderRadius: 8, flex: 1 };
const th = { textAlign: "left", padding: "8px 6px", borderBottom: "1px solid #e2e8f0" };
const td = { padding: "8px 6px", borderBottom: "1px solid #f1f5f9" };
const btnPrimary = { padding: "8px 12px", border: 0, borderRadius: 8, background: "#2563eb", color: "white", cursor: "pointer" };
const btnGhost   = { marginLeft: 8, padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc", cursor: "pointer" };
const btnDanger  = { marginLeft: 8, padding: "8px 12px", border: "1px solid #ef4444", borderRadius: 8, background: "#fee2e2", color: "#991b1b", cursor: "pointer" };
