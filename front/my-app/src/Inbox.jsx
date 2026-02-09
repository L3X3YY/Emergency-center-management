import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";

export default function Inbox({ me }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [convs, setConvs] = useState([]);     // [{conversation_id, last_message, timestamp}]
  const [activeId, setActiveId] = useState(null);
  const [msgs, setMsgs] = useState([]);       // messages for active
  const [input, setInput] = useState("");

  const scrollRef = useRef(null);
  const pollRef = useRef(null);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await api.conversations();
      setConvs(data.conversations || []);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  const loadMessages = async (cid) => {
    if (!cid) return;
    try {
      const data = await api.messages(cid);
      setMsgs(data.messages || []);
      // scroll to bottom
      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 0);
    } catch (e) {
      // ignore per-chat errors for now
    }
  };

  useEffect(() => { loadConversations(); }, []);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);

  // poll every 3s when a chat is open
  useEffect(() => {
    if (!activeId) return;
    pollRef.current = setInterval(() => loadMessages(activeId), 3000);
    return () => { clearInterval(pollRef.current); };
  }, [activeId]);

  const isSystemConv = useMemo(() => (cid) => cid?.startsWith("system_"), []);
  const otherUserIdFromDm = useMemo(() => (cid) => {
    // dm_<idA>_<idB>, find the other one
    if (!cid?.startsWith("dm_") || !me?.id) return null;
    const parts = cid.split("_");
    const a = parts[1], b = parts[2];
    return a === me.id ? b : b === me.id ? a : null;
  }, [me]);

  const send = async () => {
    const txt = input.trim();
    if (!txt || !activeId) return;
    // prevent sending in system thread
    if (isSystemConv(activeId)) {
      alert("You cannot reply to System messages.");
      return;
    }
    const other = otherUserIdFromDm(activeId);
    if (!other) {
      alert("Cannot determine recipient.");
      return;
    }
    try {
      setInput("");
      await api.sendMessage(other, txt);
      await loadMessages(activeId);
      await loadConversations(); // update last message preview
    } catch (e) {
      alert(e.message);
    }
  };

  const startNewDm = async () => {
    // quick-and-dirty: ask for the recipient user_id (or future: email lookup)
    const uid = prompt("Enter the recipient user_id:");
    if (!uid) return;
    const cid = `dm_${[me.id, uid].sort().join("_")}`;
    setActiveId(cid);
    // sending a first message will create the thread
  };

  if (loading && convs.length === 0) return <div>Loading…</div>;
  if (err) return <div style={{ color: "crimson" }}>Error: {err}</div>;

  return (
    <div style={wrap}>
      {/* left: conversations */}
      <div style={left}>
        <div style={leftHeader}>
          <div>Inbox</div>
          <button onClick={startNewDm} style={btnGhost}>New DM</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {convs.length === 0 ? (
            <div style={{ padding: 8, opacity: 0.7 }}>No conversations yet</div>
          ) : convs.map(c => {
            const active = c.conversation_id === activeId;
            const isSys = isSystemConv(c.conversation_id);
            const label = isSys ? "System" : (otherUserIdFromDm(c.conversation_id) || c.conversation_id);
            return (
              <div
                key={c.conversation_id}
                onClick={() => setActiveId(c.conversation_id)}
                style={{ ...convItem, ...(active ? convActive : {}) }}
              >
                <div style={{ fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.last_message}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* right: chat */}
      <div style={right}>
        {!activeId ? (
          <div style={{ padding: 16, opacity: 0.7 }}>Select a conversation</div>
        ) : (
          <>
            <div style={chatHeader}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {isSystemConv(activeId) ? "System" : (otherUserIdFromDm(activeId) || activeId)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{activeId}</div>
              </div>
            </div>

            <div style={chatBody} ref={scrollRef}>
              {msgs.map(m => {
                const mine = m.from === me.id;
                return (
                  <div key={m._id} style={{ display:"flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                    <div style={{ ...bubble, ...(mine ? bubbleMine : bubbleTheirs) }}>
                      {m.system && <span style={sysTag}>SYSTEM</span>}
                      {m.content}
                      <div style={time}>
                        {new Date(m.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={chatInputRow}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isSystemConv(activeId) ? "You cannot reply to System" : "Type a message"}
                disabled={isSystemConv(activeId)}
                style={inputBox}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              />
              <button onClick={send} disabled={isSystemConv(activeId) || !input.trim()} style={btnPrimary}>Send</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const wrap = { display:"flex", height: 520, width: "100%", maxWidth: 960, background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" };
const left = { width: 300, borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" };
const leftHeader = { padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" };
const right = { flex: 1, display: "flex", flexDirection: "column" };
const convItem = { padding: 10, cursor: "pointer", borderBottom: "1px solid #f1f5f9" };
const convActive = { background: "#eff6ff" };
const chatHeader = { padding: 12, borderBottom: "1px solid #e2e8f0", background: "#f8fafc" };
const chatBody = { flex: 1, padding: 12, overflowY: "auto", background: "#fdfdfd" };
const chatInputRow = { display: "flex", gap: 8, padding: 10, borderTop: "1px solid #e2e8f0" };
const inputBox = { flex: 1, padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8 };
const btnGhost = { padding:"6px 10px", border:"1px solid #e2e8f0", borderRadius:6, background:"#f8fafc", cursor:"pointer" };
const btnPrimary = { padding:"8px 12px", border:0, borderRadius:8, background:"#2563eb", color:"white", cursor:"pointer" };
const bubble = { maxWidth: "70%", padding: "8px 10px", margin: "4px 0", borderRadius: 10, position: "relative", fontSize: 14 };
const bubbleMine = { background:"#dbeafe", alignSelf: "flex-end" };
const bubbleTheirs = { background:"#f1f5f9" };
const sysTag = { fontSize: 10, fontWeight: 700, marginRight: 6, color:"#7c3aed" };
const time = { fontSize: 10, opacity: 0.7, marginTop: 2 };
