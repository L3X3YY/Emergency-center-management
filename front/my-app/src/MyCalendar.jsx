import { useEffect, useMemo, useState } from "react";
import { api, getToken } from "./api";
import CalendarGrid from "./CalendarGrid";

function yyyymm(d){ const y=d.getFullYear(); const m=(d.getMonth()+1).toString().padStart(2,"0"); return `${y}-${m}`; }

export default function MyCalendar() {
  const [monthDate, setMonthDate] = useState(new Date());
  const [myShifts, setMyShifts] = useState([]);   // [{date, center_id, center_name}]
  const [busy, setBusy] = useState([]);           // ["YYYY-MM-DD", ...]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  const monthStr = useMemo(() => yyyymm(monthDate), [monthDate]);

  const load = async () => {
    try {
      setLoading(true);
      const [s, b] = await Promise.all([
        api.mySchedule(monthStr),   // {days:[{date, center_id, center_name}]}
        api.myBusyList(monthStr),   // {days:[date,...]}
      ]);
      setMyShifts(s.days || []);
      setBusy(b.days || []);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [monthStr]);

  // Merge into a single map for the grid
  const daysMap = useMemo(() => {
    const map = {};
    myShifts.forEach(d => { map[d.date] = { assigned: true, center_id: d.center_id, center_name: d.center_name }; });
    busy.forEach(date => {
      if (!map[date]) map[date] = { assigned: false };
      map[date].busy = true;
    });
    return map;
  }, [myShifts, busy]);

  const prevMonth = () => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1));
  const nextMonth = () => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1));

  // Toggle busy when clicking a day (not allowed on assigned days)
  const toggleBusy = async (dateStr, info = {}) => {
    if (info.assigned) {
      alert("You already have a shift on this date.");
      return;
    }
    setSaving(true);
    try {
      if (info.busy) {
        await api.myBusyRemove(dateStr);
      } else {
        await api.myBusyAdd(dateStr);
      }
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!getToken()) return <div style={{ padding: 16 }}>Please log in.</div>;
  if (loading && myShifts.length === 0 && busy.length === 0) return <div style={{ padding: 16 }}>Loading…</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>Error: {err}</div>;

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom: 12 }}>
        <button onClick={prevMonth} style={btnGhost}>◀ Prev</button>
        <button onClick={nextMonth} style={btnGhost}>Next ▶</button>
        <span style={badge}>Click a day to toggle “Busy”. Leads cannot assign you on busy days.</span>
        {saving && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>Saving…</span>}
      </div>

      <CalendarGrid
        year={monthDate.getFullYear()}
        month={monthDate.getMonth()+1}
        daysMap={daysMap}
        onDayClick={toggleBusy}
        isLead={false}
        clickable={true}                // allow clicks here
        clickHint="(click to toggle Busy)"
        membersById={{}}
        labelFor={(info) => `Center: ${info.center_name}`}
      />
    </div>
  );
}

const btnGhost = { padding:"8px 12px", border:"1px solid #e2e8f0", borderRadius:8, background:"#f8fafc", cursor:"pointer" };
const badge = { padding:"4px 8px", borderRadius: 8, background:"#f1f5f9", border:"1px solid #e2e8f0", fontSize: 12 };
