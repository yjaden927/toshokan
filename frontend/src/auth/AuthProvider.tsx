import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { auth, type User } from "../lib/api";
import { AuthContext } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    // The session cookie is HttpOnly, so the page can't read it; asking the API is the only
    // way to know whether this browser is signed in. Any failure, including the API being
    // down, shows the sign-in page, which reports a connection problem if one persists.
    auth
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setUser(await auth.login(email, password));
  }, []);

  const signup = useCallback(async (input: { email: string; password: string; displayName: string }) => {
    setUser(await auth.signup(input));
  }, []);

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, signup, logout }), [user, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
