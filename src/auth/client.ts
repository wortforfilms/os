import {
  browserAdminSummary,
  browserCurrentSession,
  browserLogin,
  browserLogout,
  browserSignup,
} from "./browserAuthStore";
import type { AdminSummaryResult, AuthResult, AuthSession } from "./types";

const SESSION_KEY = "maataa.auth.session.id";

export type AuthClient = {
  backend: "electron-sqlite" | "browser-preview";
  login(username: string, password: string): Promise<AuthResult>;
  signup(username: string, password: string): Promise<AuthResult>;
  currentSession(): Promise<AuthResult>;
  logout(): Promise<void>;
  adminSummary(): Promise<AdminSummaryResult>;
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
