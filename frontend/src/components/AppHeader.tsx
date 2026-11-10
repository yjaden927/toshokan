import { Link } from "react-router";
import { useAuth } from "../auth/context";
import { Button } from "./ui";

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="flex items-center justify-between">
      <Link to="/library" className="font-serif text-2xl tracking-tight">
        Toshokan
      </Link>
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="hidden sm:inline">{user?.displayName || user?.email}</span>
        <Button variant="secondary" onClick={() => void logout()}>
          Sign out
        </Button>
      </div>
    </header>
  );
}
