// src/api.js
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:5000";

export const getToken = () => localStorage.getItem("token");
export const setToken = (t) => localStorage.setItem("token", t);
export const clearToken = () => localStorage.removeItem("token");

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // auth
  register: (form) => request("/register", { method: "POST", body: form }),
  login: (email, password) => request("/login", { method: "POST", body: { email, password } }),
  me: () => request("/me", { auth: true }),

  // admin
  adminUsers:   () => request("/admin/users",   { auth: true }),
  adminPending: () => request("/admin/pending", { auth: true }),
  adminApprove: (id) => request(`/admin/approve/${id}`, { method: "PATCH", auth: true }),
  adminReject:  (id) => request(`/admin/reject/${id}`,  { method: "PATCH", auth: true }),

// centersAdmin
  centersList:   () => request("/centers", { auth: true }),
  centerCreate:  (payload) => request("/centers", { method: "POST", auth: true, body: payload }),
  centerUpdate:  (id, payload) => request(`/centers/${id}`, { method: "PATCH", auth: true, body: payload }),
  centerDelete:  (id) => request(`/centers/${id}`, { method: "DELETE", auth: true }),

// centers (current user sees only theirs; admin sees all)
centersList:   () => request("/centers", { auth: true }),
centerMembers: (centerId) => request(`/centers/${centerId}/members`, { auth: true }),

// schedule
scheduleMonth: (centerId, yyyymm) =>
  request(`/centers/${centerId}/schedule?month=${yyyymm}`, { auth: true }),
scheduleAssign: (centerId, medic_id, date) =>
  request(`/centers/${centerId}/schedule`, {
    method: "POST", auth: true, body: { medic_id, date },
  }),
scheduleReplace: (centerId, medic_id, date) =>
  request(`/centers/${centerId}/schedule`, {
    method: "PUT", auth: true, body: { medic_id, date },
  }),
scheduleUnassign: (centerId, date) =>
  request(`/centers/${centerId}/schedule/${date}`, { method: "DELETE", auth: true }),

// inbox / messaging
conversations: () => request("/conversations", { auth: true }),
messages: (conversationId) => request(`/messages/${conversationId}`, { auth: true }),
sendMessage: (to_user_id, content) =>
  request(`/messages`, { method: "POST", auth: true, body: { to_user_id, content } }),

// assign lead
centerAssignLead: (centerId, user_id) =>
  request(`/centers/${centerId}/assign-lead`, {
    method: "PATCH", auth: true, body: { user_id },
  }),

// my schedule
mySchedule: (yyyymm) => request(`/my/schedule?month=${yyyymm}`, { auth: true }),

// my busy days
myBusyList:  (yyyymm)             => request(`/my/busy?month=${yyyymm}`, { auth: true }),
myBusyAdd:   (date)               => request(`/my/busy`, { method: "POST", auth: true, body: { date } }),
myBusyRemove:(date)               => request(`/my/busy/${date}`, { method: "DELETE", auth: true }),



};
