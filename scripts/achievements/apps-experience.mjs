// Group: Apps & Experience — probes for per-app PWA isolation.
const appDirs = (root, join, readdirSync) =>
  readdirSync(join(root, "apps"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "electron")
    .map((e) => e.name);

export const probes = [
  {
    id: "a-pwa-manifest-isolation",
    universe: "pwa",
    futureMilestone: "Each app ships an isolated PWA manifest (unique id + scope, favicon, valid manifest)",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const apps = appDirs(root, join, readdirSync);
      const ids = new Set();
      const scopes = new Set();
      let valid = 0;
      for (const a of apps) {
        const dir = join(root, "apps", a);
        const mPath = join(dir, "manifest.webmanifest");
        if (!existsSync(mPath) || !existsSync(join(dir, "favicon.svg")) || !existsSync(join(dir, "index.html"))) continue;
        let m;
        try {
          m = JSON.parse(readFileSync(mPath, "utf8"));
        } catch {
          continue;
        }
        if (!(m.id && m.scope && m.name && Array.isArray(m.icons) && m.icons.length > 0)) continue;
        ids.add(m.id);
        scopes.add(m.scope);
        valid += 1;
      }
      return {
        pass: apps.length > 0 && valid === apps.length && ids.size === valid && scopes.size === valid,
        evidence: `${valid}/${apps.length} apps with valid+isolated manifest (unique ids=${ids.size}, unique scopes=${scopes.size}, each with favicon.svg + index.html)`,
      };
    },
  },
  {
    id: "a-pwa-service-worker-isolation",
    universe: "pwa",
    futureMilestone: "Each app has an isolated service worker with a unique cache name + registration",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const apps = appDirs(root, join, readdirSync);
      const caches = new Set();
      let ok = 0;
      for (const a of apps) {
        const dir = join(root, "apps", a);
        if (!existsSync(join(dir, "sw.js")) || !existsSync(join(dir, "index.html"))) continue;
        const sw = readFileSync(join(dir, "sw.js"), "utf8");
        const html = readFileSync(join(dir, "index.html"), "utf8");
        const cacheMatch = sw.match(/const CACHE = "([^"]+)"/);
        const scoped = /url\.pathname\.startsWith\(SCOPE\)/.test(sw);
        const registered = /serviceWorker\.register\("\.\/sw\.js"/.test(html);
        if (cacheMatch && scoped && registered) {
          caches.add(cacheMatch[1]);
          ok += 1;
        }
      }
      return {
        pass: apps.length > 0 && ok === apps.length && caches.size === ok,
        evidence: `${ok}/${apps.length} apps with isolated SW (unique cache names=${caches.size}, scope-limited fetch + registered in index.html)`,
      };
    },
  },
  // ── NEW PROBES ────────────────────────────────────────────────────────────
  {
    id: "a-apps-theme-color-unique",
    universe: "pwa",
    futureMilestone: "Each app declares a unique theme-color in its index.html (no two apps share a brand color)",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const apps = appDirs(root, join, readdirSync);
      const colors = new Set();
      let ok = 0;
      for (const a of apps) {
        const htmlPath = join(root, "apps", a, "index.html");
        if (!existsSync(htmlPath)) continue;
        const html = readFileSync(htmlPath, "utf8");
        const m = html.match(/name="theme-color"\s+content="([^"]+)"/);
        if (m) {
          colors.add(m[1]);
          ok += 1;
        }
      }
      return {
        pass: apps.length > 0 && ok === apps.length && colors.size === ok,
        evidence: `${ok}/${apps.length} apps declare theme-color in index.html; ${colors.size} unique colors (${[...colors].join(", ")})`,
      };
    },
  },
  {
    id: "a-apps-manifest-standalone-display",
    universe: "pwa",
    futureMilestone: "Every app manifest declares display=standalone (enabling installable PWA experience)",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const apps = appDirs(root, join, readdirSync);
      let ok = 0;
      const notStandalone = [];
      for (const a of apps) {
        const mPath = join(root, "apps", a, "manifest.webmanifest");
        if (!existsSync(mPath)) continue;
        let m;
        try { m = JSON.parse(readFileSync(mPath, "utf8")); } catch { continue; }
        if (m.display === "standalone") {
          ok += 1;
        } else {
          notStandalone.push(`${a}:${m.display ?? "missing"}`);
        }
      }
      return {
        pass: apps.length > 0 && ok === apps.length && notStandalone.length === 0,
        evidence: `${ok}/${apps.length} manifests declare display="standalone"` +
          (notStandalone.length ? `; non-standalone: ${notStandalone.join(", ")}` : ""),
      };
    },
  },
  {
    id: "a-apps-manifest-icon-purposes",
    universe: "pwa",
    futureMilestone: "Every app manifest ships icons with both 'any' and 'maskable' purposes (adaptive icon support)",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const apps = appDirs(root, join, readdirSync);
      let ok = 0;
      const missing = [];
      for (const a of apps) {
        const mPath = join(root, "apps", a, "manifest.webmanifest");
        if (!existsSync(mPath)) continue;
        let m;
        try { m = JSON.parse(readFileSync(mPath, "utf8")); } catch { continue; }
        const icons = Array.isArray(m.icons) ? m.icons : [];
        const purposes = icons.map((i) => i.purpose ?? "");
        const hasAny = purposes.includes("any");
        const hasMaskable = purposes.includes("maskable");
        if (hasAny && hasMaskable) {
          ok += 1;
        } else {
          missing.push(`${a}(any=${hasAny},maskable=${hasMaskable})`);
        }
      }
      return {
        pass: apps.length > 0 && ok === apps.length && missing.length === 0,
        evidence: `${ok}/${apps.length} apps ship icons with both "any" and "maskable" purpose` +
          (missing.length ? `; incomplete: ${missing.join(", ")}` : ""),
      };
    },
  },
  {
    id: "a-apps-theme-color-manifest-html-consistent",
    universe: "pwa",
    futureMilestone: "Each app's manifest theme_color matches its index.html meta theme-color (consistent branding)",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const apps = appDirs(root, join, readdirSync);
      let ok = 0;
      const mismatches = [];
      for (const a of apps) {
        const htmlPath = join(root, "apps", a, "index.html");
        const mPath = join(root, "apps", a, "manifest.webmanifest");
        if (!existsSync(htmlPath) || !existsSync(mPath)) continue;
        const html = readFileSync(htmlPath, "utf8");
        let m;
        try { m = JSON.parse(readFileSync(mPath, "utf8")); } catch { continue; }
        const htmlMatch = html.match(/name="theme-color"\s+content="([^"]+)"/);
        if (!htmlMatch) continue;
        if (htmlMatch[1] === m.theme_color) {
          ok += 1;
        } else {
          mismatches.push(`${a}(html=${htmlMatch[1]},manifest=${m.theme_color})`);
        }
      }
      return {
        pass: apps.length > 0 && ok === apps.length && mismatches.length === 0,
        evidence: `${ok}/${apps.length} apps have matching theme_color in manifest and index.html` +
          (mismatches.length ? `; mismatches: ${mismatches.join(", ")}` : ""),
      };
    },
  },
  {
    id: "a-apps-favicon-svg-valid",
    universe: "pwa",
    futureMilestone: "Each app ships a valid SVG favicon (file exists and opens with <svg tag)",
    probe({ root, join, existsSync, readFileSync, readdirSync }) {
      const apps = appDirs(root, join, readdirSync);
      let ok = 0;
      const invalid = [];
      for (const a of apps) {
        const svgPath = join(root, "apps", a, "favicon.svg");
        if (!existsSync(svgPath)) { invalid.push(`${a}:missing`); continue; }
        const content = readFileSync(svgPath, "utf8").trimStart();
        if (content.startsWith("<svg")) {
          ok += 1;
        } else {
          invalid.push(`${a}:not-svg`);
        }
      }
      return {
        pass: apps.length > 0 && ok === apps.length && invalid.length === 0,
        evidence: `${ok}/${apps.length} apps ship a favicon.svg that opens with <svg` +
          (invalid.length ? `; invalid: ${invalid.join(", ")}` : ""),
      };
    },
  },
];
