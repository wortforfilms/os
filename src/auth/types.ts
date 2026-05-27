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

export type DomainRegistryResult =
  | {
      ok: true;
      domains: Array<{ id: string; name: string; state: string; owner: string; created_at: number }>;
    }
  | { ok: false; error: string };

export type BillingSummaryResult =
  | {
      ok: true;
      summary: {
        adapter: "local-dev-simulator";
        entitlements: Array<{ id: string; state: string; sku: string; label: string; username: string }>;
        invoices: Array<{ id: string; amount_minor: number; state: string; sku: string; username: string }>;
      };
    }
  | { ok: false; error: string };

export type AdminAnalyticsResult =
  | {
      ok: true;
      summary: {
        counts: Record<string, number>;
        recentAudit: Array<{ action: string; result: string; actor: string; created_at: number }>;
      };
    }
  | { ok: false; error: string };

export type AuthBridge = {
  authLogin(payload: { username: string; password: string }): Promise<AuthResult>;
  authSignup(payload: { username: string; password: string }): Promise<AuthResult>;
  authCurrentSession(sessionId: string | null): Promise<AuthResult>;
  authLogout(sessionId: string | null): Promise<LogoutResult>;
  adminSummary(sessionId: string | null): Promise<AdminSummaryResult>;
  domainRegistry(): Promise<DomainRegistryResult>;
  billingSummary(sessionId: string | null): Promise<BillingSummaryResult>;
  adminAnalytics(sessionId: string | null): Promise<AdminAnalyticsResult>;
};

export type SupportDocsBridgeResult =
  | {
      ok: true;
      shell: "electron";
      manifest: {
        schema: "maataa.support.docs.v1";
        productionReady: false;
        finalStatus: "GOVERNED_PRODUCTION_NO_GO";
        supportMode: "PREVIEW_AND_LOCAL_VALIDATION";
        documents: Array<{
          id: string;
          title: string;
          path: string;
          status: "READY" | "PREVIEW" | "BLOCKED";
          audience: "users" | "operators";
          summary: string;
        }>;
      };
    }
  | { ok: false; error: string };

declare global {
  interface Window {
    maataaDesktop?: {
      runtimeInfo?: () => Promise<unknown>;
      supportDocs?: () => Promise<SupportDocsBridgeResult>;
    } & Partial<AuthBridge>;
  }
}
