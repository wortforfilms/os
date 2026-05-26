import {
  browserAdminSummary,
  browserCurrentSession,
  browserLogin,
  browserLogout,
  browserSignup,
} from "./browserAuthStore";
import type { AdminAnalyticsResult, AdminSummaryResult, AuthResult, AuthSession, BillingSummaryResult, DomainRegistryResult } from "./types";

const SESSION_KEY = "maataa.auth.session.id";

export type AuthClient = {
  backend: "electron-sqlite" | "browser-preview";
  login(username: string, password: string): Promise<AuthResult>;
  signup(username: string, password: string): Promise<AuthResult>;
  currentSession(): Promise<AuthResult>;
  logout(): Promise<void>;
  adminSummary(): Promise<AdminSummaryResult>;
  domainRegistry(): Promise<DomainRegistryResult>;
  billingSummary(): Promise<BillingSummaryResult>;
  adminAnalytics(): Promise<AdminAnalyticsResult>;
  persistSession(session: AuthSession): void;
};

export function createAuthClient(): AuthClient {
  const bridge = window.maataaDesktop;
  const hasElectronAuth =
    typeof bridge?.authLogin === "function" &&
    typeof bridge.authSignup === "function" &&
    typeof bridge.authCurrentSession === "function" &&
    typeof bridge.authLogout === "function" &&
    typeof bridge.adminSummary === "function";

  if (hasElectronAuth) {
    return {
      backend: "electron-sqlite",
      async login(username, password) {
        const result = await bridge.authLogin?.({ username, password });
        return persistIfOk(result);
      },
      async signup(username, password) {
        const result = await bridge.authSignup?.({ username, password });
        return persistIfOk(result);
      },
      async currentSession() {
        return bridge.authCurrentSession?.(readSessionId()) ?? { ok: false, error: "NO_SESSION" };
      },
      async logout() {
        await bridge.authLogout?.(readSessionId());
        clearSessionId();
      },
      async adminSummary() {
        return bridge.adminSummary?.(readSessionId()) ?? { ok: false, error: "NO_SESSION" };
      },
      async domainRegistry() {
        return bridge.domainRegistry?.() ?? browserDomainRegistry();
      },
      async billingSummary() {
        return bridge.billingSummary?.(readSessionId()) ?? browserBillingSummary(readSessionId());
      },
      async adminAnalytics() {
        return bridge.adminAnalytics?.(readSessionId()) ?? browserAdminAnalytics(readSessionId());
      },
      persistSession,
    };
  }

  return {
    backend: "browser-preview",
    async login(username, password) {
      return persistIfOk(await browserLogin(username, password));
    },
    async signup(username, password) {
      return persistIfOk(await browserSignup(username, password));
    },
    currentSession() {
      return browserCurrentSession(readSessionId());
    },
    async logout() {
      await browserLogout(readSessionId());
      clearSessionId();
    },
    adminSummary() {
      return browserAdminSummary(readSessionId());
    },
    async domainRegistry() {
      return browserDomainRegistry();
    },
    billingSummary() {
      return browserBillingSummary(readSessionId());
    },
    adminAnalytics() {
      return browserAdminAnalytics(readSessionId());
    },
    persistSession,
  };
}

function persistIfOk(result: AuthResult | undefined): AuthResult {
  if (!result) {
    return { ok: false, error: "AUTH_BRIDGE_UNAVAILABLE" };
  }
  if (result.ok) {
    persistSession(result.session);
  }
  return result;
}

function persistSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, session.id);
}

function readSessionId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function clearSessionId(): void {
  localStorage.removeItem(SESSION_KEY);
}

function browserDomainRegistry(): DomainRegistryResult {
  return {
    ok: true,
    domains: [
      { id: "dom_runtime", name: "runtime.maataa.local", state: "CONTROLLED_GO", owner: "brahmini", created_at: Date.now() },
      { id: "dom_lipi", name: "lipi.maataa.local", state: "PREVIEW_VERIFIED", owner: "vishNu", created_at: Date.now() },
      { id: "dom_radio", name: "radio.vaigyaaniq.local", state: "STAGED", owner: "vishNu", created_at: Date.now() },
    ],
  };
}

async function browserBillingSummary(sessionId: string | null): Promise<BillingSummaryResult> {
  const current = await browserCurrentSession(sessionId);
  if (!current.ok) {
    return current;
  }
  return {
    ok: true,
    summary: {
      adapter: "local-dev-simulator",
      entitlements: [
        { id: "ent_admin_dashboard", state: "ACTIVE", sku: "MSAR-DASHBOARD-LOCAL", label: "MSAR Dashboard Local Seat", username: "brahmini" },
        { id: "ent_producer_radio", state: "PREVIEW_ONLY", sku: "RADIO-VGQ-PREVIEW", label: "Radio Vaigyaaniq Preview Entitlement", username: "vishNu" },
      ],
      invoices: [
        { id: "inv_radio_preview_001", amount_minor: 1000, state: "LOCAL_SIMULATED", sku: "RADIO-VGQ-PREVIEW", username: "vishNu" },
      ],
    },
  };
}

async function browserAdminAnalytics(sessionId: string | null): Promise<AdminAnalyticsResult> {
  const current = await browserCurrentSession(sessionId);
  if (!current.ok) {
    return current;
  }
  if (current.session.role !== "Admin") {
    return { ok: false, error: "ROLE_DENIED" };
  }
  return {
    ok: true,
    summary: {
      counts: { auditLogs: 1, runtimeEvents: 2, telemetryEvents: 1, invoices: 1, entitlements: 2 },
      recentAudit: [{ action: "analytics.access", result: "PASS", actor: current.session.username, created_at: Date.now() }],
    },
  };
}
