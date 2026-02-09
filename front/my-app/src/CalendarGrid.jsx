// src/CalendarGrid.jsx
import { useMemo } from "react";

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function dowMon0(jsDow){ return (jsDow + 6) % 7; }

export default function CalendarGrid({
  year,
  month,
  daysMap,
  onDayClick,
  isLead,                // keep for backwards compat
  membersById = {},
  labelFor,              // (info, dateStr) => string
  clickable,             // override clickability (e.g., My Calendar)
  clickHint,             // text under the cell when clickable
}) {
  const { weeks, monthLabel } = useMemo(() => {
    const first = startOfMonth(new Date(year, month - 1, 1));
    const last  = endOfMonth(first);
    const label = first.toLocaleString(undefined, { month: "long", year: "numeric" });
    const leading = dowMon0(first.getDay());
    const totalDays = last.getDate();
    const cells = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month - 1, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return { weeks, monthLabel: label };
  }, [year, month]);

  const dayStyle = (canClick) => ({
    border: "1px solid #e2e8f0",
    minHeight: 100,
    padding: 8,
    verticalAlign: "top",
    background: "white",
    cursor: canClick ? "pointer" : "default",
  });

  const badge = {
    display: "inline-block",
    marginTop: 6,
    padding: "2px 6px",
    borderRadius: 6,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    fontSize: 12,
  };

  const busyBadgeStyle = { ...badge, background: "#fee2e2", borderColor: "#fecaca", color: "#991b1b", marginLeft: 6 };

  const head = { background:"#f8fafc", borderBottom:"1px solid #e2e8f0", padding: 6, fontWeight: 600, textAlign: "center" };
  const weekday = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

  const defaultAssignedLabel = (info) => {
    const medicName = info?.medic_id ? (membersById[info.medic_id]?.name || info.medic_id) : undefined;
    return medicName ? `Assigned: ${medicName}` : "Assigned";
  };

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{weekday.map((w) => <th key={w} style={head}>{w}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((row, i) => (
            <tr key={i}>
              {row.map((d, j) => {
                if (!d) return <td key={j} style={{ ...dayStyle(false), background:"#f8fafc" }} />;

                const y = d.getFullYear();
                const m = (d.getMonth()+1).toString().padStart(2, "0");
                const dd = d.getDate().toString().padStart(2, "0");
                const key = `${y}-${m}-${dd}`;

                const info = daysMap[key];
                const assigned = info?.assigned;
                const isBusy   = info?.busy === true;

                const canClick = typeof clickable === "boolean" ? clickable : isLead;
                const label = assigned
                  ? (labelFor ? labelFor(info, key) : defaultAssignedLabel(info))
                  : null;

                return (
                  <td key={j} style={dayStyle(canClick)} onClick={() => canClick && onDayClick(key, info)}>
                    <div style={{ fontWeight: 600 }}>{d.getDate()}</div>

                    {assigned ? (
                      <div style={badge}>{label}</div>
                    ) : (
                      <div style={{ ...badge, background:"#fff7ed", borderColor:"#fed7aa" }}>Unassigned</div>
                    )}

                    {isBusy && <span style={busyBadgeStyle}>Busy</span>}

                    {canClick && (
                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                        {clickHint ?? `(click to ${assigned ? "change" : "toggle"})`}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, textAlign: "right", opacity: 0.7 }}>{monthLabel}</div>
    </div>
  );
}
