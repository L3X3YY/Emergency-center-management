const BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

export function getToken() { return localStorage.getItem("token"); }
export function setToken(t) { localStorage.setItem("token", t); }
export function clearToken() { localStorage.removeItem("token"); }

async function request(path, { method = "GET", auth = false, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) throw new Error((data && (data.error || data.msg)) || res.statusText);
  return data;
}

//support
async function supportMessage({ message, email }) {
  // auth: true means we’ll include the JWT if present; if not, it simply won’t add the header
  return request("/support", {
    method: "POST",
    auth: true,
    body: { message, email }, // email optional for logged-in users
  });
}
// --- Support (admin) ---
async function adminSupportList(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/admin/support${qs ? `?${qs}` : ""}`, { auth: true });
}
async function adminSupportSetResolved(id, resolved) {
  return request(`/admin/support/${id}`, {
    method: "PATCH",
    auth: true,
    body: { resolved },
  });
}

async function usersBasics(ids = []) {
  if (!ids.length) return { users: [] };
  const qs = encodeURIComponent(ids.join(","));
  return request(`/users/basics?ids=${qs}`, { auth: true });
}



// Profile
async function profileUpdate(payload) {
  return request("/me", {
    method: "PATCH",
    auth: true,
    body: payload,
  });
}

async function profileChangePassword(current_password, new_password, confirm_password) {
  return request("/me/change-password", {
    method: "POST",
    auth: true,
    body: { current_password, new_password, confirm_password },
  });
}

async function userFindByEmail(email) {
  // GET /users/find?email=...
  return request(`/users/find?email=${encodeURIComponent(email)}`, {
    auth: true,
  });
}

async function centerAddMember(centerId, userId) {
  return request(`/centers/${centerId}/members`, {
    method: "POST",
    auth: true,
    body: { user_id: userId },
  });
}

async function centerRemoveMember(centerId, userId) {
  return request(`/centers/${centerId}/members/${userId}`, {
    method: "DELETE",
    auth: true,
  });
}
// reporrts
async function centerReports(centerId, month) {
  return request(`/centers/${centerId}/reports?month=${encodeURIComponent(month)}`, {
    auth: true,
  });
}
async function centerReportsCsv(centerId, month) {
  const headers = {};
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;

  const res = await fetch(
    `${BASE_URL}/centers/${centerId}/reports.csv?month=${encodeURIComponent(month)}`,
    { headers }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt || `Failed to download CSV (${res.status})`);
  }
  return await res.blob();
}

//admin
// --- admin user management ---
async function adminUserUpdateEmail(userId, email) {
  return request(`/admin/users/${userId}/email`, {
    method: "PATCH",
    auth: true,
    body: { email }
  });
}
async function adminUserSetPassword(userId, password) {
  return request(`/admin/users/${userId}/password`, {
    method: "PATCH",
    auth: true,
    body: { password }
  });
}
async function adminUserDelete(userId) {
  return request(`/admin/users/${userId}`, {
    method: "DELETE",
    auth: true
  });
}





export const api = {
  // auth
  register: (payload) => request("/register", { method: "POST", body: payload }),
  login: (email, password) => request("/login", { method: "POST", body: { email, password } }),
  me: () => request("/me", { auth: true }),

  // admin
  adminPending: () => request("/admin/pending", { auth: true }),
  adminApprove: (userId) => request(`/admin/approve/${userId}`, { method: "PATCH", auth: true }),
  adminReject: (userId) => request(`/admin/reject/${userId}`, { method: "PATCH", auth: true }),
  adminUsers: () => request("/admin/users", { auth: true }),
    adminUserUpdateEmail,
  adminUserSetPassword,
  adminUserDelete,

  // centers + memberships
  centersList: () => request("/centers", { auth: true }),
  centerCreate: (payload) => request("/centers", { method: "POST", auth: true, body: payload }),
  centerUpdate: (id, payload) => request(`/centers/${id}`, { method: "PATCH", auth: true, body: payload }),
  centerDelete: (id) => request(`/centers/${id}`, { method: "DELETE", auth: true }),
  centerMembers: (centerId) => request(`/centers/${centerId}/members`, { auth: true }),
  centerAddMember: (centerId, userId) =>
    request(`/centers/${centerId}/members`, { method: "POST", auth: true, body: { user_id: userId } }),
  centerRemoveMember: (centerId, userId) =>
    request(`/centers/${centerId}/members/${userId}`, { method: "DELETE", auth: true }),
  centerAssignLead: (centerId, userId) =>
    request(`/centers/${centerId}/assign-lead`, { method: "PATCH", auth: true, body: { user_id: userId } }),

  // schedules (center calendars)
  scheduleGet: (centerId, yyyymm) => request(`/centers/${centerId}/schedule?month=${yyyymm}`, { auth: true }),
  scheduleAssign: (centerId, medic_id, date) =>
    request(`/centers/${centerId}/schedule`, { method: "POST", auth: true, body: { medic_id, date } }),
  scheduleReplace: (centerId, medic_id, date) =>
    request(`/centers/${centerId}/schedule`, { method: "PUT", auth: true, body: { medic_id, date } }),
  scheduleUnassign: (centerId, date) =>
    request(`/centers/${centerId}/schedule/${date}`, { method: "DELETE", auth: true }),

  // my schedule + busy days
  mySchedule: (yyyymm) => request(`/my/schedule?month=${yyyymm}`, { auth: true }),
  myBusyList: (yyyymm) => request(`/my/busy?month=${yyyymm}`, { auth: true }),
  myBusyAdd: (date) => request(`/my/busy`, { method: "POST", auth: true, body: { date } }),
  myBusyRemove: (date) => request(`/my/busy/${date}`, { method: "DELETE", auth: true }),

  // messaging
  conversations: () => request(`/conversations`, { auth: true }),
  messagesGet: (conversation_id) => request(`/messages/${conversation_id}`, { auth: true }),
  messageSend: (to_user_id, content) =>
    request(`/messages`, { method: "POST", auth: true, body: { to_user_id, content } }),

  //profile updates
  profileUpdate,
  profileChangePassword,

  //center updates
    userFindByEmail,
  centerAddMember,
  centerRemoveMember,

  //reports
  centerReports,
  centerReportsCsv,
  //support
  supportMessage,
  adminSupportList,
  adminSupportSetResolved,

  usersBasics,
};
