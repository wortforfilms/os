export type UserRole = "Admin" | "Producer" | "Viewer";

export type AuthSession = {
  id: string;
  userId: string;
  username: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
};

export type AdminSummary = {
  counts: {
    users: number;
    activeSessions: number;
    auditLogs: number;
  };
  users: Array<{
    username: string;
    role: UserRole;
    state: string;
  }>;
};

export type AuthResult =
  | { ok: true; session: AuthSession }
  | { ok: false; error: "INVALID_CREDENTIALS" | "USER_EXISTS" | "NO_SESSION" | "SESSION_EXPIRED" | "ROLE_DENIED" | string };

export type LogoutResult = { ok: true } | { ok: false; error: string };

export type AdminSummaryResult = { ok: true; summary: AdminSummary } | { ok: false; error: string };

export type AuthBridge = {
  authLogin(payload: { username: string; password: string }): Promise<AuthResult>;
  authSignup(payload: { username: string; password: string }): Promise<AuthResult>;
  authCurrentSession(sessionId: string | null): Promise<AuthResult>;
  authLogout(sessionId: string | null): Promise<LogoutResult>;
  adminSummary(sessionId: string | null): Promise<AdminSummaryResult>;
};

declare global {
  interface Window {
    maataaDesktop?: {
      runtimeInfo?: () => Promise<unknown>;
    } & Partial<AuthBridge>;
  }
}
