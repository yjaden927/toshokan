import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/context";
import { Button, Field, Input } from "../components/ui";
import { ApiError } from "../lib/api";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match an account.",
  email_taken: "An account with that email already exists. Sign in instead.",
  too_many_requests: "Too many attempts. Wait a few minutes and try again.",
  network_error: "Couldn't reach the server. Check your connection and try again.",
};

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { user, login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";
  const from = (location.state as { from?: string } | null)?.from ?? "/library";

  if (user) return <Navigate to={from} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setFieldErrors({});
    setBusy(true);
    try {
      if (isSignup) await signup({ email, password, displayName });
      else await login(email, password);
      navigate(from, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === "invalid_input") setFieldErrors(e.fields);
      else setError((e instanceof ApiError && MESSAGES[e.code]) || "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <Link to="/" className="mb-10 font-serif text-2xl tracking-tight">
        Toshokan
      </Link>
      <div className="surface w-full max-w-md rounded-[20px] p-8">
        <h1 className="text-center font-serif text-4xl">{isSignup ? "Start your library" : "Welcome back"}</h1>
        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          {isSignup && (
            <Field label="Name" error={fieldErrors.displayName?.[0]}>
              {(id, describedBy) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              )}
            </Field>
          )}
          <Field label="Email" error={fieldErrors.email?.[0]}>
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={Boolean(fieldErrors.email)}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            )}
          </Field>
          <Field
            label="Password"
            error={fieldErrors.password?.[0]}
            hint={isSignup ? "At least 8 characters" : undefined}
          >
            {(id, describedBy) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={Boolean(fieldErrors.password)}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <Link to={isSignup ? "/login" : "/signup"} className="font-medium text-accent hover:underline">
            {isSignup ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </main>
  );
}
