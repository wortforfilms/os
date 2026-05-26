import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createAuthStore } from "../apps/electron/auth-store.cjs";

function withStore(fn) {
  const dir = mkdtempSync(join(tmpdir(), "maataa-auth-"));
  const store = createAuthStore(join(dir, "auth.sqlite"));
  try {
    fn(store);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("seed admin can login, reach admin summary, and logout", () => {
  withStore((store) => {
    const login = store.login("brahmini", "brahmini-admin-local");
    assert.equal(login.ok, true);
    assert.equal(login.session.role, "Admin");

    const summary = store.adminSummary(login.session.id);
    assert.equal(summary.ok, true);
    assert.equal(summary.summary.counts.users, 3);
    assert.equal(summary.summary.users.some((user) => user.username === "vishNu" && user.role === "Producer"), true);

    const logout = store.logout(login.session.id);
    assert.equal(logout.ok, true);
    assert.equal(store.currentSession(login.session.id).ok, false);
  });
});

test("producer seed user is authenticated but denied admin role access", () => {
  withStore((store) => {
    const login = store.login("vishNu", "vishnu-producer-local");
    assert.equal(login.ok, true);
    assert.equal(login.session.role, "Producer");

    const admin = store.adminSummary(login.session.id);
    assert.equal(admin.ok, false);
    assert.equal(admin.error, "ROLE_DENIED");
  });
});

test("signup creates a viewer session and remains fail-closed for admin", () => {
  withStore((store) => {
    const signup = store.signup("localViewer", "viewer-local-password");
    assert.equal(signup.ok, true);
    assert.equal(signup.session.role, "Viewer");

    const current = store.currentSession(signup.session.id);
    assert.equal(current.ok, true);
    assert.equal(current.session.username, "localViewer");

    const admin = store.adminSummary(signup.session.id);
    assert.equal(admin.ok, false);
    assert.equal(admin.error, "ROLE_DENIED");
  });
});

test("invalid credentials do not create a session", () => {
  withStore((store) => {
    const login = store.login("mahesh", "wrong-password");
    assert.equal(login.ok, false);
    assert.equal(login.error, "INVALID_CREDENTIALS");
  });
});

test("domain, billing, and admin analytics registries are local and role gated", () => {
  withStore((store) => {
    const adminLogin = store.login("brahmini", "brahmini-admin-local");
    assert.equal(adminLogin.ok, true);

    const domains = store.domainRegistry();
    assert.equal(domains.ok, true);
    assert.equal(domains.domains.some((domain) => domain.name === "runtime.maataa.local"), true);

    const billing = store.billingSummary(adminLogin.session.id);
    assert.equal(billing.ok, true);
    assert.equal(billing.summary.adapter, "local-dev-simulator");
    assert.equal(billing.summary.entitlements.length >= 2, true);

    const analytics = store.adminAnalytics(adminLogin.session.id);
    assert.equal(analytics.ok, true);
    assert.equal(analytics.summary.counts.runtimeEvents >= 2, true);

    const producerLogin = store.login("vishNu", "vishnu-producer-local");
    assert.equal(producerLogin.ok, true);
    assert.equal(store.adminAnalytics(producerLogin.session.id).ok, false);
    assert.equal(store.billingSummary(producerLogin.session.id).ok, true);
  });
});
