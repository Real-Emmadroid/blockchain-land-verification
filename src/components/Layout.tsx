import { NavLink, Link, Outlet, useNavigate } from "react-router-dom";
import { Buildings, ClockCounterClockwise, Gauge, ArrowsLeftRight, SealCheck, SignOut, UsersThree, House, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { useAuth } from "../app-context";
import type { Role } from "../lib/types";

export function Brand({ light }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <SealCheck size={28} weight="fill" className={light ? "text-[#7fd1a8]" : "text-brand"} aria-hidden />
      <span className={`text-[15px] font-bold leading-tight tracking-tight ${light ? "text-rail-ink" : "text-ink"}`}>
        Land Verification
        <span className={`block text-[11px] font-medium ${light ? "text-rail-muted" : "text-muted"}`}>Property document registry</span>
      </span>
    </span>
  );
}

const NAV: Record<Role, { to: string; label: string; icon: typeof Gauge; end?: boolean }[]> = {
  registrar: [
    { to: "/admin", label: "Dashboard", icon: Gauge, end: true },
    { to: "/admin/properties", label: "Properties", icon: Buildings },
    { to: "/admin/transfers", label: "Transfers", icon: ArrowsLeftRight },
    { to: "/admin/users", label: "Users", icon: UsersThree },
    { to: "/admin/log", label: "Verification log", icon: ClockCounterClockwise },
  ],
  owner: [
    { to: "/owner", label: "Dashboard", icon: Gauge, end: true },
    { to: "/owner/properties", label: "My properties", icon: House },
    { to: "/owner/transfers", label: "Transfers", icon: ArrowsLeftRight },
  ],
};

export function AppShell({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV[role];
  const signOut = () => {
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? "bg-rail-active text-rail-ink" : "text-rail-muted hover:bg-rail-active/60 hover:text-rail-ink"
    }`;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="bg-rail lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:px-3 lg:py-5">
        <div className="flex items-center justify-between px-4 py-3 lg:px-3 lg:pb-6 lg:pt-0">
          <Link to={role === "registrar" ? "/admin" : "/owner"}>
            <Brand light />
          </Link>
          <button onClick={signOut} className="rounded-lg p-2 text-rail-muted hover:bg-rail-active hover:text-rail-ink lg:hidden" aria-label="Log out">
            <SignOut size={20} />
          </button>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon size={19} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden px-3 pt-4 text-xs text-rail-muted lg:block">
          <Link to="/verify" className="mb-3 flex items-center gap-2 py-1 hover:text-rail-ink">
            <MagnifyingGlassPlus size={16} aria-hidden /> Public verification page
          </Link>
          Testnet demo. No real property data.
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex items-center justify-end gap-3 border-b border-line bg-surface px-4 py-3 sm:px-8">
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold">{user?.name}</p>
            <p className="text-xs capitalize text-muted">{user?.role}</p>
          </div>
          <button
            onClick={signOut}
            className="hidden items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-2 lg:inline-flex"
          >
            <SignOut size={16} aria-hidden /> Log out
          </button>
        </header>
        <main className="rise mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function PublicShell() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link to="/">
            <Brand />
          </Link>
          <nav aria-label="Public" className="flex items-center gap-1 text-sm font-medium">
            <Link to="/verify" className="rounded-lg px-3 py-2 hover:bg-surface-2">
              Verify
            </Link>
            <Link to="/login" className="rounded-lg px-3 py-2 text-brand hover:bg-brand-soft">
              Log in
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">
        <Outlet />
      </div>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-8">
          Final-year project. Records are written to the Ethereum Sepolia test network, which holds no real value.
        </div>
      </footer>
    </div>
  );
}
