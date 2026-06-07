import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { SovereignDashboard } from "../packages/maataa-ui/src/SovereignDashboard";
import { createAuthClient, type AuthClient } from "./auth/client";
import type { AdminAnalyticsResult, AdminSummary, AuthSession, BillingSummaryResult } from "./auth/types";
import { DomainRegistryPage } from "./domains/DomainRegistryPage";
import { CommandPalette } from "./search/CommandPalette";
import { SearchPage } from "./search/SearchPage";
import { useRuntimeStatus } from "./runtime/useRuntimeStatus";
import { supportDocs, type SupportDoc, type SupportDocsManifest } from "./support/docs";

type RouteId =
  | "/"
  | "/dashboard"
  | "/auth/login"
  | "/auth/signup"
  | "/admin"
  | "/domains"
  | "/domains/status"
  | "/domains/runtime"
  | "/docs"
  | "/settings"
  | "/search";
type AuthStatus = "checking" | "anonymous" | "authenticated";

const protectedRoutes = new Set<RouteId>(["/admin"]);

function currentPath(): RouteId {
  const path = window.location.pathname as RouteId;
  if (
    path === "/" ||
    path === "/dashboard" ||
    path === "/auth/login" ||
    path === "/auth/signup" ||
    path === "/admin" ||
    path === "/domains" ||
    path === "/domains/status" ||
    path === "/domains/runtime" ||
    path === "/docs" ||
    path === "/search" ||
    path === "/settings"
  ) {
    return path;
  }
  return "/";
}

export function App() {
  const auth = useMemo(() => createAuthClient(), []);
  const [route, setRoute] = useState<RouteId>(() => currentPath());
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [session, setSession] = useState<AuthSession | null>(null);
  const runtimeStatus = useRuntimeStatus();

  useEffect(() => {
    const onPop = () => setRoute(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    let mounted = true;
    auth.currentSession().then((result) => {
      if (!mounted) {
        return;
      }
      if (result.ok) {
        setSession(result.session);
        setStatus("authenticated");
      } else {
        setSession(null);
        setStatus("anonymous");
      }
    });
    return () => {
      mounted = false;
    };
  }, [auth]);

  function navigate(nextRoute: string): void {
    const safeRoute = normalizeRoute(nextRoute);
    if (!safeRoute) {
      return;
    }
    window.history.pushState(null, "", safeRoute);
    setRoute(safeRoute);
  }

  async function logout(): Promise<void> {
    await auth.logout();
    setSession(null);
    setStatus("anonymous");
    navigate("/auth/login");
  }

  if (status === "checking") {
    return <AuthFrame title="Session Check" detail="Verifying local session boundary." backend={auth.backend} />;
  }

  if (protectedRoutes.has(route) && !session) {
    return (
        <AuthShell route="/auth/login" navigate={navigate} session={session} logout={logout}>
          <AccessBlocked reason="NO_SESSION" detail="Protected routes fail closed until a valid local session exists." />
        </AuthShell>
    );
  }

  if (route === "/auth/login") {
    return (
      <AuthShell route={route} navigate={navigate} session={session} logout={logout}>
        <AuthForm mode="login" auth={auth} onAuthenticated={(nextSession) => {
          setSession(nextSession);
          setStatus("authenticated");
          navigate(nextSession.role === "Admin" ? "/admin" : "/dashboard");
        }} />
      </AuthShell>
    );
  }

  if (route === "/auth/signup") {
    return (
      <AuthShell route={route} navigate={navigate} session={session} logout={logout}>
        <AuthForm mode="signup" auth={auth} onAuthenticated={(nextSession) => {
          setSession(nextSession);
          setStatus("authenticated");
          navigate("/dashboard");
        }} />
      </AuthShell>
    );
  }

  if (route === "/admin") {
    return (
      <AuthShell route={route} navigate={navigate} session={session} logout={logout}>
        <AdminShell auth={auth} session={session} />
      </AuthShell>
    );
  }

  if (route === "/search") {
    return (
      <AuthShell route={route} navigate={navigate} session={session} logout={logout}>
        <SearchPage navigate={navigate} />
      </AuthShell>
    );
  }

  if (route === "/domains" || route === "/domains/status" || route === "/domains/runtime") {
    return (
      <AuthShell route={route} navigate={navigate} session={session} logout={logout}>
        <DomainRegistryPage route={route} navigate={navigate} />
      </AuthShell>
    );
  }

  if (route === "/docs") {
    return (
      <AuthShell route={route} navigate={navigate} session={session} logout={logout}>
        <DocsShell />
      </AuthShell>
    );
  }

  if (route === "/settings") {
    return (
      <AuthShell route={route} navigate={navigate} session={session} logout={logout}>
        <SettingsShell backend={auth.backend} session={session} />
      </AuthShell>
    );
  }

  return (
    <>
      <SovereignDashboard runtimeStatus={runtimeStatus} />
      <CommandPalette navigate={navigate} />
    </>
  );
}

function AuthShell({
  route,
  navigate,
  session,
  logout,
  children,
}: {
  route: RouteId;
  navigate: (route: string) => void;
  session: AuthSession | null;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  return (
    <div className="auth-product-shell">
      <aside className="auth-nav" aria-label="Product navigation">
        <div className="brand-mark">M</div>
        {(["/", "/dashboard", "/admin", "/domains", "/search", "/docs", "/settings"] as const).map((item) => (
          <button className={route === item ? "active" : ""} key={item} onClick={() => navigate(item)}>
            {item === "/" ? "Home" : item.replace("/", "")}
          </button>
        ))}
        <button onClick={() => navigate("/auth/login")}>login</button>
        <button onClick={() => navigate("/auth/signup")}>signup</button>
      </aside>
      <main className="auth-main">
        <header className="auth-topbar">
          <div>
            <p className="dashboard-kicker">Local Auth Slice</p>
            <h1>Fail-closed roles over local session state.</h1>
          </div>
          <div className="session-card">
            <span>{session ? `${session.username} / ${session.role}` : "NO_SESSION"}</span>
            {session ? <button onClick={logout}>Logout</button> : null}
          </div>
        </header>
        {children}
        <CommandPalette navigate={navigate} />
      </main>
    </div>
  );
}

function normalizeRoute(path: string): RouteId | null {
  if (
    path === "/" ||
    path === "/dashboard" ||
    path === "/auth/login" ||
    path === "/auth/signup" ||
    path === "/admin" ||
    path === "/domains" ||
    path === "/domains/status" ||
    path === "/domains/runtime" ||
    path === "/docs" ||
    path === "/search" ||
    path === "/settings"
  ) {
    return path;
  }
  return null;
}

function AuthForm({
  mode,
  auth,
  onAuthenticated,
}: {
  mode: "login" | "signup";
  auth: AuthClient;
  onAuthenticated: (session: AuthSession) => void;
}) {
  const [username, setUsername] = useState(mode === "login" ? "brahmini" : "");
  const [password, setPassword] = useState(mode === "login" ? "brahmini-admin-local" : "");
  const [message, setMessage] = useState<string>("Seed users: brahmini/Admin, vishNu/Producer, mahesh/Viewer.");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("Checking local credential boundary...");
    try {
      const result = mode === "login" ? await auth.login(username, password) : await auth.signup(username, password);
      if (!result.ok) {
        setMessage(`BLOCKED: ${result.error}`);
        return;
      }
      setMessage("PASS: session persisted locally.");
      onAuthenticated(result.session);
    } catch (error) {
      setMessage(`BLOCKED: ${error instanceof Error ? error.message : "AUTH_FAILURE"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card" aria-label={mode === "login" ? "Login" : "Signup"}>
      <div>
        <p className="dashboard-kicker">{mode === "login" ? "Login" : "Signup"}</p>
        <h2>{mode === "login" ? "Open a local session." : "Create a local viewer account."}</h2>
        <p>
          Backend: <strong>{auth.backend}</strong>. Electron uses SQLite; browser-only runs a preview shadow store and keeps admin fail-closed by role.
        </p>
      </div>
      <form onSubmit={submit} className="auth-form">
        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        <button disabled={busy}>{busy ? "Checking" : mode === "login" ? "Login" : "Signup"}</button>
      </form>
      <p className="auth-message">{message}</p>
    </section>
  );
}

function AdminShell({ auth, session }: { auth: AuthClient; session: AuthSession | null }) {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [billing, setBilling] = useState<BillingSummaryResult | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalyticsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    auth.adminSummary().then((result) => {
      if (!mounted) {
        return;
      }
      if (result.ok) {
        setSummary(result.summary);
        setError(null);
      } else {
        setSummary(null);
        setError(result.error);
      }
    });
    auth.billingSummary().then((result) => {
      if (mounted) {
        setBilling(result);
      }
    });
    auth.adminAnalytics().then((result) => {
      if (mounted) {
        setAnalytics(result);
      }
    });
    return () => {
      mounted = false;
    };
  }, [auth, session]);

  if (!session) {
    return <AccessBlocked reason="NO_SESSION" detail="No local session was present when /admin resolved." />;
  }

  if (error) {
    return <AccessBlocked reason={error} detail="Role guard denied the admin shell. This is the expected fail-closed posture." />;
  }

  if (!summary) {
    return <AuthFrame title="Admin Shell" detail="Loading SQLite-backed role summary." backend={auth.backend} />;
  }

  return (
    <section className="admin-shell" aria-label="Protected admin shell">
      <div className="auth-card">
        <p className="dashboard-kicker">Protected Admin</p>
        <h2>SQLite session accepted for {session.username}.</h2>
        <div className="admin-stat-grid">
          <Stat label="Users" value={summary.counts.users} />
          <Stat label="Active Sessions" value={summary.counts.activeSessions} />
          <Stat label="Audit Logs" value={summary.counts.auditLogs} />
        </div>
      </div>
      <div className="auth-card">
        <h2>Seed Role Register</h2>
        <table className="auth-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>State</th>
            </tr>
          </thead>
          <tbody>
            {summary.users.map((user) => (
              <tr key={user.username}>
                <td>{user.username}</td>
                <td>{user.role}</td>
                <td>{user.state}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="auth-card">
        <h2>Local Billing Simulator</h2>
        {billing?.ok ? (
          <div className="admin-stat-grid">
            <Stat label="Entitlements" value={billing.summary.entitlements.length} />
            <Stat label="Invoices" value={billing.summary.invoices.length} />
            <Stat label="Adapter" value={billing.summary.adapter === "local-dev-simulator" ? 1 : 0} />
          </div>
        ) : (
          <p className="auth-message">BLOCKED: {billing?.error ?? "LOADING"}</p>
        )}
      </div>
      <div className="auth-card">
        <h2>Admin Analytics</h2>
        {analytics?.ok ? (
          <div className="admin-stat-grid">
            <Stat label="Audit Logs" value={analytics.summary.counts.auditLogs ?? 0} />
            <Stat label="Runtime Events" value={analytics.summary.counts.runtimeEvents ?? 0} />
            <Stat label="Telemetry Events" value={analytics.summary.counts.telemetryEvents ?? 0} />
          </div>
        ) : (
          <p className="auth-message">BLOCKED: {analytics?.error ?? "LOADING"}</p>
        )}
      </div>
    </section>
  );
}

function AccessBlocked({ reason, detail }: { reason: string; detail: string }) {
  return (
    <section className="access-blocked" aria-label="Access blocked">
      <strong>BLOCKED</strong>
      <h2>{reason}</h2>
      <p>{detail}</p>
    </section>
  );
}

function AuthFrame({ title, detail, backend }: { title: string; detail: string; backend: string }) {
  return (
    <div className="auth-product-shell single">
      <section className="auth-card">
        <p className="dashboard-kicker">{title}</p>
        <h2>{detail}</h2>
        <p>Backend: {backend}</p>
      </section>
    </div>
  );
}

function DocsShell() {
  const [desktopManifest, setDesktopManifest] = useState<SupportDocsManifest | null>(null);

  useEffect(() => {
    let mounted = true;
    window.maataaDesktop?.supportDocs?.().then((result) => {
      if (!mounted || !result.ok) {
        return;
      }
      setDesktopManifest(result.manifest);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const manifest = desktopManifest ?? supportDocs;
  const userDocs = manifest.documents.filter((doc) => doc.audience === "users");
  const operatorDocs = manifest.documents.filter((doc) => doc.audience === "operators");

  return (
    <section className="docs-shell">
      <div className="auth-card">
        <p className="dashboard-kicker">Docs & Support</p>
        <h2>Desktop support center for Electron and Tauri.</h2>
        <p>
          Source: {desktopManifest ? "Electron IPC manifest" : "bundled local manifest"}. Production remains{" "}
          <strong>{manifest.productionReady ? "READY" : "BLOCKED"}</strong> with final status <strong>{manifest.finalStatus}</strong>.
        </p>
      </div>
      <DocGroup title="User Documentation" docs={userDocs} />
      <DocGroup title="Operator Support" docs={operatorDocs} />
    </section>
  );
}

function DocGroup({ title, docs }: { title: string; docs: SupportDoc[] }) {
  return (
    <div className="docs-grid" aria-label={title}>
      <h2>{title}</h2>
      {docs.map((doc) => (
        <article className="doc-card" key={doc.id}>
          <header>
            <strong>{doc.title}</strong>
            <span>{doc.status}</span>
          </header>
          <p>{doc.summary}</p>
          <code>{doc.path}</code>
        </article>
      ))}
    </div>
  );
}

function SettingsShell({ backend, session }: { backend: string; session: AuthSession | null }) {
  return (
    <section className="auth-card">
      <p className="dashboard-kicker">Settings</p>
      <h2>Local runtime settings.</h2>
      <p>Auth backend: {backend}</p>
      <p>Session state: {session ? `${session.username} / ${session.role}` : "NO_SESSION"}</p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="admin-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
