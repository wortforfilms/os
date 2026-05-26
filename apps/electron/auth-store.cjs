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

function createAuthStore(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const sqliteBin = resolveSqliteBinary();
  const db = { path: databasePath, bin: sqliteBin };
  sqliteExec(db, "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  sqliteExec(db, schemaSql());
  seedUsers(db);

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
