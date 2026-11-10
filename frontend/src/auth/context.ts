import { createContext, useContext } from "react";
import type { User } from "../lib/api";

export interface AuthState {
  /** `undefined` while the first /auth/me check is in flight, `null` when signed out. */
  user: User | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { email: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth() must be used inside <AuthProvider>");
  return auth;
}
