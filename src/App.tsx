import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./app-context";
import { AppShell, PublicShell } from "./components/Layout";
import { Skeleton } from "./components/ui";
import type { Role } from "./lib/types";
import Home from "./pages/Home";
import Verify from "./pages/Verify";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Transfers from "./pages/Transfers";
import Users from "./pages/Users";
import VerificationLog from "./pages/VerificationLog";
import OwnerDashboard from "./pages/OwnerDashboard";

const homeFor = (role: Role) => (role === "registrar" ? "/admin" : "/owner");

function Guard({ role }: { role: Role }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-10" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return <AppShell role={role} />;
}

function NotFound() {
  const { user } = useAuth();
  return <Navigate to={user ? homeFor(user.role) : "/"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/login" element={<Login />} />
      </Route>

      <Route path="/admin" element={<Guard role="registrar" />}>
        <Route index element={<AdminDashboard />} />
        <Route path="properties" element={<Properties role="registrar" />} />
        <Route path="properties/:id" element={<PropertyDetail role="registrar" />} />
        <Route path="transfers" element={<Transfers role="registrar" />} />
        <Route path="users" element={<Users />} />
        <Route path="log" element={<VerificationLog />} />
      </Route>

      <Route path="/owner" element={<Guard role="owner" />}>
        <Route index element={<OwnerDashboard />} />
        <Route path="properties" element={<Properties role="owner" />} />
        <Route path="properties/:id" element={<PropertyDetail role="owner" />} />
        <Route path="transfers" element={<Transfers role="owner" />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
