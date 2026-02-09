import { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken } from "./api";
import { Navigate } from "react-router-dom";
import { Center, Spinner } from "@chakra-ui/react";


const AuthCtx = createContext(null);
export function useAuth() { return useContext(AuthCtx); }

export function AuthProvider({ children }) {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  

async function refresh() {
  setLoading(true);
  try {
    const token = getToken();
    if (!token) {
      setMe(null);
      return;
    }
    const user = await api.me();
    setMe(user);
  } catch {
    clearToken();
    setMe(null);
  } finally {
    setLoading(false); // <-- always end loading, even if no token
  }
}




  useEffect(() => { refresh(); }, []);

  const value = {
  me,
  loading,
  login: async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.access_token);
    await refresh();
    return data;
  },
  logout: () => { clearToken(); setMe(null); },
  refreshMe: refresh,           // <-- add this line
};

  

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}



export function ProtectedRoute({ children, role }) {
  const { me, loading } = useAuth();
  if (loading) return (
    <Center py={20}><Spinner /></Center>
  );
  if (!me) return <Navigate to="/auth" replace />;
  if (role === "admin" && me.global_role !== "admin") return <Navigate to="/" replace />;
  return children;
}