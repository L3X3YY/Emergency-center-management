// src/MedicDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { api, getToken } from "./api";
import CalendarGrid from "./CalendarGrid";

function yyyymm(dateObj){
  const y = dateObj.getFullYear();
  const m = (dateObj.getMonth()+1).toString().padStart(2,"0");
  return `${y}-${m}`;
}

export default function MedicDashboard({ me }) {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [members, setMembers] = useState([]);  // [{user_id, name, email, role}]
  const [days, setDays] = useState([]);        // [{date, assigned, medic_id}]
  const [monthDate, setMonthDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const monthStr = useMemo(() => yyyymm(monthDate), [monthDate]);

  const loadCenters = async () => {
    setLoading(true);
    try {
      const data = await api.centersList();
      setCenters(data.centers || []);
      if (!centerId && (data.centers?.length ?? 0) > 0) {
        setCenterId(data.centers[0]._id);
      }
      setError(null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const loadMembers = async (cid) => {
    if (!cid) return;
    try {
      const data = await api.centerMembers(cid);
      setMembers(data.members || []);
    } catch (e) {
      setMembers([]);
    }
  };

  const loadSchedule = async (cid, mstr) => {
    if (!cid) return;
    try {
      const data = await api.scheduleMonth(cid, mstr);
      setDays(data.days || []);
    } catch (e) {
      setDays([]);
    }
  };

  useEffect(() => { loadCenters(); }, []);
  useEffect(() => { if (centerId) { loadMembers(centerId); } }, [centerId]);
  useEffect(() => { if (centerId) { loadSchedule(centerId, monthStr); } }, [centerId, monthStr]);

  const isLead = useMemo(() => {
    const my = members.find(m => m.user_id === me?.id);
    return my?.role === "lead" || me?.global_role === "admin";
  }, [members, me]);

  const membersById = useMemo(() => {
    const map = {};
    members.forEach(m => map[m.user_id] = { name: m.name ?? m.email, role: m.role });
    return map;
  }, [members]);

  const daysMap = useMemo(() => {
    const map = {};
    days.forEach(d => map[d.date] = d);
    return map;
  }, [days]);

  const prevMonth = () => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1));
  const nextMonth = () => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1));

  const handleDayClick = async (dateStr, info) => {
    if (!isLead) return;
    // simple prompt-based assign UI (quick to test). You can replace with a modal later.
    const who = prompt(
      `Assign for ${dateStr}.\nEnter medic email or user_id:\n\nAvailable:\n${members.map(m => `${m.name || m.email} (${m.user_id})`).join("\n")}`
    );
    if (!who) return;

    // find by id or email
    const m = members.find(u => u.user_id === who || u.email === who);
    if (!m) { alert("Medic not found in this center"); return; }

    setSaving(true);
    try {
      if (info?.assigned) {
        await api.scheduleReplace(centerId, m.user_id, dateStr);
      } else {
        await api.scheduleAssign(centerId, m.user_id, dateStr);
      }
      await loadSchedule(centerId, monthStr);
      alert(`Assigned ${m.name || m.email} for ${dateStr}`);
    } catch (e) {
      alert(e.message);
    } finally { setSaving(false); }
  };

  if (!getToken()) return <div style={{ padding: 16 }}>Please log in.</div>;
  if (loading && centers.length === 0) return <div style={{ padding: 16 }}>Loading…</div>;
  if (error) return <div style={{ padding: 16, color: "crimson" }}>Error: {error}</div>;
  if (centers.length === 0) return <div style={{ padding: 16 }}>No centers assigned yet.</div>;

  const y = monthDate.getFullYear();
  const m = monthDate.getMonth()+1;

  return (
    <div style={{ width: "100%" }}>
      {/* Top bar: center selector + month nav + lead badge */}
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom: 12 }}>
        <select value={centerId} onChange={e => setCenterId(e.target.value)} style={sel}>
          {centers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
        <button onClick={prevMonth} style={btnGhost}>◀ Prev</button>
        <button onClick={nextMonth} style={btnGhost}>Next ▶</button>
        {isLead ? <span style={leadBadge}>Lead mode: click a day to assign</span> : <span style={viewBadge}>View only</span>}
        {saving && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>Saving…</span>}
      </div>

      {/* Calendar */}
      <CalendarGrid
        year={y}
        month={m}
        daysMap={daysMap}
        onDayClick={handleDayClick}
        isLead={isLead}
        membersById={membersById}
      />
    </div>
  );
}

const sel = { padding:"8px 10px", border:"1px solid #e2e8f0", borderRadius: 8 };
const btnGhost = { padding:"8px 12px", border:"1px solid #e2e8f0", borderRadius:8, background:"#f8fafc", cursor:"pointer" };
const leadBadge = { padding:"4px 8px", borderRadius: 8, background:"#dcfce7", border:"1px solid #86efac", fontSize: 12 };
const viewBadge = { padding:"4px 8px", borderRadius: 8, background:"#f1f5f9", border:"1px solid #e2e8f0", fontSize: 12 };
