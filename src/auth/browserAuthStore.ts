import type { AdminSummaryResult, AuthResult, AuthSession, UserRole } from "./types";

const STORE_KEY = "maataa.auth.preview.sqlite-shadow.v1";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

type StoredUser = {
  id: string;
  username: string;
  role: UserRole;
  state: "CONTROLLED_GO";
  passwordHash: string;
};

type Store = {
  users: StoredUser[];
  sessions: AuthSession[];
  auditLogs: Array<{ action: string; result: string; actor: string; createdAt: number }>;
};

const seedUsers = [
  { id: "usr_brahmini", username: "brahmini", role: "Admin" as const, password: "brahmini-admin-local" },
  { id: "usr_vishnu", username: "vishNu", role: "Producer" as const, password: "vishnu-producer-local" },
  { id: "usr_mahesh", username: "mahesh", role: "Viewer" as const, password: "mahesh-viewer-local" },
];

export async function browserLogin(username: string, password: string): Promise<AuthResult> {
  const store = await loadStore();
  const cleanUsername = assertUsername(username);
  const passwordHash = await digestPassword(password);
  const user = store.users.find((candidate) => candidate.username === cleanUsername && candidate.passwordHash === passwordHash);

  if (!user) {
    audit(store, "auth.login", "BLOCKED", cleanUsername);
    saveStore(store);
    return { ok: false, error: "INVALID_CREDENTIALS" };
  }

  const now = Date.now();
  const session: AuthSession = {
    id: crypto.randomUUID(),
    userId: user.id,
    username: user.username,
    role: user.role,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  store.sessions.push(session);
  audit(store, "auth.login", "PASS", user.username);
  saveStore(store);
  return { ok: true, session };
}

export async function browserSignup(username: string, password: string): Promise<AuthResult> {
  const store = await loadStore();
  const cleanUsername = assertUsername(username);
  assertPassword(password);

  if (store.users.some((user) => user.username === cleanUsername)) {
    audit(store, "auth.signup", "BLOCKED", cleanUsername);
    saveStore(store);
    return { ok: false, error: "USER_EXISTS" };
  }

  store.users.push({
    id: `usr_${crypto.randomUUID().replace(/-/g, "")}`,
    username: cleanUsername,
    role: "Viewer",
    state: "CONTROLLED_GO",
    passwordHash: await digestPassword(password),
  });
  audit(store, "auth.signup", "PASS", cleanUsername);
  saveStore(store);
  return browserLogin(cleanUsername, password);
}

export async function browserCurrentSession(sessionId: string | null): Promise<AuthResult> {
  const store = await loadStore();
  const session = store.sessions.find((candidate) => candidate.id === sessionId && candidate.expiresAt > Date.now());
  if (!session) {
    return { ok: false, error: "SESSION_EXPIRED" };
  }
  return { ok: true, session };
}

export async function browserLogout(sessionId: string | null) {
  const store = await loadStore();
  const before = store.sessions.length;
  store.sessions = store.sessions.filter((session) => session.id !== sessionId);
  audit(store, "auth.logout", before === store.sessions.length ? "BLOCKED" : "PASS", sessionId ?? "NO_SESSION");
  saveStore(store);
  return before === store.sessions.length ? { ok: false, error: "SESSION_NOT_FOUND" } : { ok: true };
}

export async function browserAdminSummary(sessionId: string | null): Promise<AdminSummaryResult> {
  const current = await browserCurrentSession(sessionId);
  const store = await loadStore();
  if (!current.ok) {
    audit(store, "admin.access", "BLOCKED", "NO_SESSION");
    saveStore(store);
    return current;
  }

  if (current.session.role !== "Admin") {
    audit(store, "admin.access", "BLOCKED", current.session.username);
    saveStore(store);
    return { ok: false, error: "ROLE_DENIED" };
  }

  audit(store, "admin.access", "PASS", current.session.username);
  saveStore(store);
  return {
    ok: true,
    summary: {
      counts: {
        users: store.users.length,
        activeSessions: store.sessions.filter((session) => session.expiresAt > Date.now()).length,
        auditLogs: store.auditLogs.length,
      },
      users: store.users.map(({ username, role, state }) => ({ username, role, state })),
    },
  };
}

async function loadStore(): Promise<Store> {
  const existing = localStorage.getItem(STORE_KEY);
  if (existing) {
    return JSON.parse(existing) as Store;
  }

  const store: Store = {
    users: await Promise.all(
      seedUsers.map(async (user) => ({
        id: user.id,
        username: user.username,
        role: user.role,
        state: "CONTROLLED_GO" as const,
        passwordHash: await digestPassword(user.password),
      })),
    ),
    sessions: [],
    auditLogs: [],
  };
  saveStore(store);
  return store;
}

function saveStore(store: Store): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function audit(store: Store, action: string, result: string, actor: string): void {
  store.auditLogs.push({ action, result, actor: actor.slice(0, 80), createdAt: Date.now() });
}

function assertUsername(username: string): string {
  const clean = username.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(clean)) {
    throw new Error("USERNAME_INVALID");
  }
  return clean;
}

function assertPassword(password: string): void {
  if (password.length < 8 || password.length > 128) {
    throw new Error("PASSWORD_INVALID");
  }
}

async function digestPassword(password: string): Promise<string> {
  assertPassword(password);
  const bytes = new TextEncoder().encode(`maataa-local-auth:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
