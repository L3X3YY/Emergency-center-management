import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, ProtectedRoute, useAuth } from "./auth";
import AppShell from "./ui/AppShell";

// Pages (stubs for now)
import AuthPage from "./pages/AuthPage";
import Home from "./pages/Home";
import MyCalendar from "./pages/MyCalendar";
import Centers from "./pages/Centers";
import Inbox from "./pages/Inbox";
import AdminCenters from "./pages/admin/AdminCenters";
import AdminRequests from "./pages/admin/AdminRequests";
import Profile from "./pages/Profile.jsx";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSupport from "./pages/admin/AdminSupport.jsx";


export default function App() {
  return (
    <AuthProvider>
      <AppShell>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<Guard><Home /></Guard>} />
          <Route path="/my-calendar" element={<Guard><MyCalendar /></Guard>} />
          <Route path="/centers" element={<Guard><Centers /></Guard>} />
          <Route path="/inbox" element={<Guard><Inbox /></Guard>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin/centers" element={<Guard role="admin"><AdminCenters /></Guard>} />
          <Route path="/admin/requests" element={<Guard role="admin"><AdminRequests /></Guard>} />
          <Route path="/admin/users" element={<Guard role="admin"><AdminUsers /></Guard>} />
          <Route path="/admin/support" element={<Guard role="admin"><AdminSupport /></Guard>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthProvider>
  );
}

function Guard({ children, role }) {
  return <ProtectedRoute role={role}>{children}</ProtectedRoute>;
}
