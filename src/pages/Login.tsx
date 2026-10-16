import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../app-context";
import { Banner, Button, TextInput } from "../components/ui";
import { ApiError } from "../lib/api";

const DEMO = [
  { label: "Registrar", email: "registrar@example.com", password: "Registrar123!" },
  { label: "Owner", email: "owner1@example.com", password: "Owner123!" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === "registrar" ? "/admin" : "/owner"} replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      navigate(u.role === "registrar" ? "/admin" : "/owner", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contours flex min-h-[calc(100dvh-8.5rem)] items-start justify-center px-4 py-12 sm:py-20">
      <div className="rise w-full max-w-md">
        <h1 className="text-3xl font-extrabold">Log in</h1>
        <p className="mt-1 text-muted">For registry staff and registered property owners.</p>

        <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-line bg-surface p-6" noValidate>
          {error && <Banner>{error}</Banner>}
          <TextInput label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextInput label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" loading={busy} className="w-full">Log in</Button>
        </form>

        <details className="mt-4 rounded-xl border border-line bg-surface/90 px-5 py-3 text-sm">
          <summary className="cursor-pointer font-semibold">Demo accounts</summary>
          <ul className="mt-3 space-y-3">
            {DEMO.map((d) => (
              <li key={d.email} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="block font-semibold">{d.label}</span>
                  <span className="hash text-muted">{d.email} / {d.password}</span>
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => { setEmail(d.email); setPassword(d.password); }}>
                  Fill in
                </Button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
