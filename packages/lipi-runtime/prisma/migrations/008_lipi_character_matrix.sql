CREATE TABLE IF NOT EXISTS LipiScript (
  id TEXT PRIMARY KEY,
  isoCode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  nativeName TEXT,
  direction TEXT NOT NULL,
  family TEXT,
  wave TEXT,
  status TEXT NOT NULL,
  unicodeRange TEXT,
  oldestProof TEXT,
  extinctionReason TEXT,
  creatorType TEXT,
  creatorName TEXT,
  region TEXT,
  purpose TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS LipiCharacter (
  id TEXT PRIMARY KEY,
  scriptId TEXT NOT NULL,
  token TEXT NOT NULL,
  glyph TEXT NOT NULL,
  unicode TEXT,
  phoneticValue TEXT,
  ipa TEXT,
  transliteration TEXT,
  category TEXT NOT NULL,
  anchorStatus TEXT NOT NULL,
  FOREIGN KEY (scriptId) REFERENCES LipiScript(id)
);

CREATE TABLE IF NOT EXISTS LipiLineageEdge (
  id TEXT PRIMARY KEY,
  parentScriptId TEXT NOT NULL,
  childScriptId TEXT NOT NULL,
  relationType TEXT NOT NULL,
  confidence REAL NOT NULL,
  evidenceNote TEXT,
  FOREIGN KEY (parentScriptId) REFERENCES LipiScript(id),
  FOREIGN KEY (childScriptId) REFERENCES LipiScript(id)
);
