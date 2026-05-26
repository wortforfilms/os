const { randomBytes, randomUUID, pbkdf2Sync, timingSafeEqual } = require("node:crypto");
const { existsSync, mkdirSync } = require("node:fs");
const { dirname } = require("node:path");
const { execFileSync } = require("node:child_process");

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

const SEED_USERS = [
  { id: "usr_brahmini", username: "brahmini", role: "Admin", password: "brahmini-admin-local" },
  { id: "usr_vishnu", username: "vishNu", role: "Producer", password: "vishnu-producer-local" },
  { id: "usr_mahesh", username: "mahesh", role: "Viewer", password: "mahesh-viewer-local" },
];

const VALID_ROLES = new Set(["Admin", "Producer", "Viewer"]);
const SEED_DOMAINS = [
  { id: "dom_runtime", name: "runtime.maataa.local", state: "CONTROLLED_GO", owner: "brahmini" },
  { id: "dom_lipi", name: "lipi.maataa.local", state: "PREVIEW_VERIFIED", owner: "vishNu" },
  { id: "dom_radio", name: "radio.vaigyaaniq.local", state: "STAGED", owner: "vishNu" },
];
const SEED_PRODUCTS = [
  { id: "prd_msr_dashboard", sku: "MSAR-DASHBOARD-LOCAL", label: "MSAR Dashboard Local Seat", amount: 0 },
  { id: "prd_radio_preview", sku: "RADIO-VGQ-PREVIEW", label: "Radio Vaigyaaniq Preview Entitlement", amount: 1000 },
];

function createAuthStore(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const sqliteBin = resolveSqliteBinary();
  const db = { path: databasePath, bin: sqliteBin };
  sqliteExec(db, "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  sqliteExec(db, schemaSql());
  seedUsers(db);
  seedDomains(db);
  seedProducts(db);
  seedRuntimeRows(db);

  return {
    databasePath,
    login(username, password) {
      const cleanUsername = sanitizeUsername(username);
      assertPassword(password);
      const user = sqliteGet(
        db,
        `SELECT id, username, role, password_salt, password_hash FROM users WHERE username = ${sqlQuote(cleanUsername)} AND disabled_at IS NULL LIMIT 1;`,
      );

      if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
        audit(db, "auth.login", "BLOCKED", cleanUsername);
        return { ok: false, error: "INVALID_CREDENTIALS" };
      }

      const now = Date.now();
      const session = {
        id: randomUUID(),
        userId: user.id,
        username: user.username,
        role: user.role,
        createdAt: now,
        expiresAt: now + SESSION_TTL_MS,
      };

      sqliteExec(
        db,
        `INSERT INTO sessions (id, user_id, created_at, expires_at, revoked_at) VALUES (${sqlQuote(session.id)}, ${sqlQuote(session.userId)}, ${session.createdAt}, ${session.expiresAt}, NULL);`,
      );
      audit(db, "auth.login", "PASS", user.username);
      return { ok: true, session };
    },

    signup(username, password) {
      const cleanUsername = sanitizeUsername(username);
      assertPassword(password);
      const existing = sqliteGet(db, `SELECT id FROM users WHERE username = ${sqlQuote(cleanUsername)} LIMIT 1;`);
      if (existing) {
        audit(db, "auth.signup", "BLOCKED", cleanUsername);
        return { ok: false, error: "USER_EXISTS" };
      }

      const id = `usr_${randomUUID().replaceAll("-", "")}`;
      const salt = randomBytes(16).toString("hex");
      const hash = hashPassword(password, salt);
      const now = Date.now();
      sqliteExec(
        db,
        [
          "INSERT INTO users (id, username, role, state, password_salt, password_hash, created_at, disabled_at) VALUES",
          `(${sqlQuote(id)}, ${sqlQuote(cleanUsername)}, 'Viewer', 'CONTROLLED_GO', ${sqlQuote(salt)}, ${sqlQuote(hash)}, ${now}, NULL);`,
        ].join(" "),
      );
      audit(db, "auth.signup", "PASS", cleanUsername);
      return this.login(cleanUsername, password);
    },

    currentSession(sessionId) {
      if (!sessionId || typeof sessionId !== "string") {
        return { ok: false, error: "NO_SESSION" };
      }

      const now = Date.now();
      const row = sqliteGet(
        db,
        [
          "SELECT sessions.id, sessions.user_id, sessions.created_at, sessions.expires_at, users.username, users.role",
          "FROM sessions JOIN users ON users.id = sessions.user_id",
          `WHERE sessions.id = ${sqlQuote(sessionId)} AND sessions.revoked_at IS NULL AND sessions.expires_at > ${now} AND users.disabled_at IS NULL`,
          "LIMIT 1;",
        ].join(" "),
      );

      if (!row) {
        return { ok: false, error: "SESSION_EXPIRED" };
      }

      return {
        ok: true,
        session: {
          id: row.id,
          userId: row.user_id,
          username: row.username,
          role: row.role,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
        },
      };
    },

    logout(sessionId) {
      if (!sessionId || typeof sessionId !== "string") {
        return { ok: false, error: "NO_SESSION" };
      }
      const openSession = sqliteGet(db, `SELECT id FROM sessions WHERE id = ${sqlQuote(sessionId)} AND revoked_at IS NULL LIMIT 1;`);
      const changed = Boolean(openSession);
      if (changed) {
        sqliteExec(db, `UPDATE sessions SET revoked_at = ${Date.now()} WHERE id = ${sqlQuote(sessionId)} AND revoked_at IS NULL;`);
      }
      audit(db, "auth.logout", changed ? "PASS" : "BLOCKED", sessionId);
      return changed ? { ok: true } : { ok: false, error: "SESSION_NOT_FOUND" };
    },

    adminSummary(sessionId) {
      const current = this.currentSession(sessionId);
      if (!current.ok) {
        audit(db, "admin.access", "BLOCKED", "NO_SESSION");
        return current;
      }
      if (current.session.role !== "Admin") {
        audit(db, "admin.access", "BLOCKED", current.session.username);
        return { ok: false, error: "ROLE_DENIED" };
      }

      const counts = {
        users: sqliteScalar(db, "SELECT COUNT(*) AS value FROM users WHERE disabled_at IS NULL;"),
        activeSessions: sqliteScalar(db, `SELECT COUNT(*) AS value FROM sessions WHERE revoked_at IS NULL AND expires_at > ${Date.now()};`),
        auditLogs: sqliteScalar(db, "SELECT COUNT(*) AS value FROM audit_logs;"),
      };
      const users = sqliteAll(db, "SELECT username, role, state FROM users WHERE disabled_at IS NULL ORDER BY username;");
      audit(db, "admin.access", "PASS", current.session.username);
      return { ok: true, summary: { counts, users } };
    },

    domainRegistry() {
      return {
        ok: true,
        domains: sqliteAll(db, "SELECT id, name, state, owner, created_at FROM domains ORDER BY name;"),
      };
    },

    billingSummary(sessionId) {
      const current = this.currentSession(sessionId);
      if (!current.ok) {
        audit(db, "billing.access", "BLOCKED", "NO_SESSION");
        return current;
      }
      const entitlements = sqliteAll(
        db,
        [
          "SELECT entitlements.id, entitlements.state, products.sku, products.label, users.username",
          "FROM entitlements",
          "JOIN products ON products.id = entitlements.product_id",
          "JOIN users ON users.id = entitlements.user_id",
          "ORDER BY products.sku;",
        ].join(" "),
      );
      const invoices = sqliteAll(
        db,
        [
          "SELECT invoices.id, invoices.amount_minor, invoices.state, products.sku, users.username",
          "FROM invoices",
          "JOIN products ON products.id = invoices.product_id",
          "JOIN users ON users.id = invoices.user_id",
          "ORDER BY invoices.id;",
        ].join(" "),
      );
      audit(db, "billing.access", "PASS", current.session.username);
      return { ok: true, summary: { adapter: "local-dev-simulator", entitlements, invoices } };
    },

    adminAnalytics(sessionId) {
      const current = this.currentSession(sessionId);
      if (!current.ok) {
        audit(db, "analytics.access", "BLOCKED", "NO_SESSION");
        return current;
      }
      if (current.session.role !== "Admin") {
        audit(db, "analytics.access", "BLOCKED", current.session.username);
        return { ok: false, error: "ROLE_DENIED" };
      }
      const summary = {
        auditLogs: sqliteScalar(db, "SELECT COUNT(*) AS value FROM audit_logs;"),
        runtimeEvents: sqliteScalar(db, "SELECT COUNT(*) AS value FROM runtime_events;"),
        telemetryEvents: sqliteScalar(db, "SELECT COUNT(*) AS value FROM telemetry_events;"),
        invoices: sqliteScalar(db, "SELECT COUNT(*) AS value FROM invoices;"),
        entitlements: sqliteScalar(db, "SELECT COUNT(*) AS value FROM entitlements;"),
      };
      const recentAudit = sqliteAll(db, "SELECT action, result, actor, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 8;");
      audit(db, "analytics.access", "PASS", current.session.username);
      return { ok: true, summary: { counts: summary, recentAudit } };
    },

    close() {
      // sqlite3 CLI opens per command, so there is no long-lived handle to close.
    },
  };
}

function schemaSql() {
  return `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('Admin', 'Producer', 'Viewer')),
  state TEXT NOT NULL CHECK(state IN ('EXPERIMENTAL', 'STAGED', 'PREVIEW_VERIFIED', 'CONTROLLED_GO', 'CONTROLLED_NO_GO', 'BLOCKED', 'DEPRECATED')),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  disabled_at INTEGER
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  owner TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  amount_minor INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  state TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  amount_minor INTEGER NOT NULL,
  state TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runtime_events (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS telemetry_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS system_admin_analytics_log (
  id TEXT PRIMARY KEY,
  indicator TEXT NOT NULL,
  state TEXT NOT NULL,
  evidence TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;
}

function seedUsers(db) {
  const now = Date.now();
  for (const user of SEED_USERS) {
    const existing = sqliteGet(db, `SELECT id FROM users WHERE username = ${sqlQuote(user.username)} LIMIT 1;`);
    if (existing) {
      continue;
    }
    const salt = randomBytes(16).toString("hex");
    sqliteExec(
      db,
      [
        "INSERT INTO users (id, username, role, state, password_salt, password_hash, created_at, disabled_at) VALUES",
        `(${sqlQuote(user.id)}, ${sqlQuote(user.username)}, ${sqlQuote(user.role)}, 'CONTROLLED_GO', ${sqlQuote(salt)}, ${sqlQuote(hashPassword(user.password, salt))}, ${now}, NULL);`,
      ].join(" "),
    );
  }
}

function seedDomains(db) {
  const now = Date.now();
  for (const domain of SEED_DOMAINS) {
    const existing = sqliteGet(db, `SELECT id FROM domains WHERE id = ${sqlQuote(domain.id)} LIMIT 1;`);
    if (existing) {
      continue;
    }
    sqliteExec(
      db,
      `INSERT INTO domains (id, name, state, owner, created_at) VALUES (${sqlQuote(domain.id)}, ${sqlQuote(domain.name)}, ${sqlQuote(domain.state)}, ${sqlQuote(domain.owner)}, ${now});`,
    );
  }
}

function seedProducts(db) {
  for (const product of SEED_PRODUCTS) {
    const existing = sqliteGet(db, `SELECT id FROM products WHERE id = ${sqlQuote(product.id)} LIMIT 1;`);
    if (!existing) {
      sqliteExec(
        db,
        `INSERT INTO products (id, sku, label, amount_minor) VALUES (${sqlQuote(product.id)}, ${sqlQuote(product.sku)}, ${sqlQuote(product.label)}, ${product.amount});`,
      );
    }
  }
  const adminEntitlement = sqliteGet(db, "SELECT id FROM entitlements WHERE id = 'ent_admin_dashboard' LIMIT 1;");
  if (!adminEntitlement) {
    sqliteExec(
      db,
      "INSERT INTO entitlements (id, user_id, product_id, state) VALUES ('ent_admin_dashboard', 'usr_brahmini', 'prd_msr_dashboard', 'ACTIVE');",
    );
  }
  const radioEntitlement = sqliteGet(db, "SELECT id FROM entitlements WHERE id = 'ent_producer_radio' LIMIT 1;");
  if (!radioEntitlement) {
    sqliteExec(
      db,
      "INSERT INTO entitlements (id, user_id, product_id, state) VALUES ('ent_producer_radio', 'usr_vishnu', 'prd_radio_preview', 'PREVIEW_ONLY');",
    );
  }
  const invoice = sqliteGet(db, "SELECT id FROM invoices WHERE id = 'inv_radio_preview_001' LIMIT 1;");
  if (!invoice) {
    sqliteExec(
      db,
      "INSERT INTO invoices (id, user_id, product_id, amount_minor, state) VALUES ('inv_radio_preview_001', 'usr_vishnu', 'prd_radio_preview', 1000, 'LOCAL_SIMULATED');",
    );
  }
}

function seedRuntimeRows(db) {
  const now = Date.now();
  if (sqliteScalar(db, "SELECT COUNT(*) AS value FROM runtime_events;") === 0) {
    sqliteExec(
      db,
      `INSERT INTO runtime_events (id, route, state, created_at) VALUES ('rte_boot', '/', 'PREVIEW_VERIFIED', ${now}), ('rte_search', '/search', 'PREVIEW_VERIFIED', ${now + 1});`,
    );
  }
  if (sqliteScalar(db, "SELECT COUNT(*) AS value FROM telemetry_events;") === 0) {
    sqliteExec(
      db,
      `INSERT INTO telemetry_events (id, event_type, payload_json, created_at) VALUES ('tel_local_heartbeat', 'heartbeat', '{"transport":"electron-ipc"}', ${now});`,
    );
  }
  if (sqliteScalar(db, "SELECT COUNT(*) AS value FROM system_admin_analytics_log;") === 0) {
    sqliteExec(
      db,
      [
        "INSERT INTO system_admin_analytics_log (id, indicator, state, evidence, created_at) VALUES",
        `('silicon_attestation_mmio', 'Hardware root of trust', 'BLOCKED', 'MMIO binding at 0xFE001000 implemented; target fused-register read not captured.', ${now}),`,
        `('radio_ncr_cluster', 'NCR appliance cluster', 'CONTROLLED_GO', 'Delhi/Noida/Gurugram loopback ports and MAC masks registered with airgap lock.', ${now + 1});`,
      ].join(" "),
    );
  }
}

function sanitizeUsername(username) {
  if (typeof username !== "string") {
    throw new Error("USERNAME_REQUIRED");
  }
  const clean = username.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{2,31}$/.test(clean)) {
    throw new Error("USERNAME_INVALID");
  }
  return clean;
}

function assertPassword(password) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new Error("PASSWORD_INVALID");
  }
}

function hashPassword(password, salt) {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST).toString("hex");
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function audit(db, action, result, actor) {
  sqliteExec(
    db,
    `INSERT INTO audit_logs (id, action, result, actor, created_at) VALUES (${sqlQuote(randomUUID())}, ${sqlQuote(action)}, ${sqlQuote(result)}, ${sqlQuote(String(actor).slice(0, 80))}, ${Date.now()});`,
  );
}

function resolveSqliteBinary() {
  const candidates = [
    process.env.MAATAA_SQLITE3_BIN,
    "/usr/bin/sqlite3",
    "/opt/homebrew/bin/sqlite3",
    "/opt/anaconda3/bin/sqlite3",
    "sqlite3",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (candidate.includes("/") && !existsSync(candidate)) {
        continue;
      }
      execFileSync(candidate, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      return candidate;
    } catch {
      // Try the next local candidate.
    }
  }

  throw new Error("SQLITE3_BINARY_NOT_FOUND");
}

function sqliteExec(db, sql) {
  execFileSync(db.bin, [db.path, sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function sqliteJson(db, sql) {
  const output = execFileSync(db.bin, ["-json", db.path, sql], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  return output ? JSON.parse(output) : [];
}

function sqliteAll(db, sql) {
  return sqliteJson(db, sql);
}

function sqliteGet(db, sql) {
  return sqliteJson(db, sql)[0];
}

function sqliteScalar(db, sql) {
  const row = sqliteGet(db, sql);
  return Number(row?.value ?? 0);
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

module.exports = {
  SEED_USERS,
  createAuthStore,
};
