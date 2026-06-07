#!/usr/bin/env node
// Generates isolated PWA entries for each app: a unique manifest.webmanifest,
// a unique favicon.svg, and a standalone index.html that wires them in.
//
// PHKD: purely ADDITIVE (no existing source is edited) → rollback-safe. Each app
// gets an isolated scope, unique id, unique theme colour, unique favicon glyph.
// Shared runtime infrastructure stays shared; only the installable shell is per-app.
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// One row per app. Colours + glyphs are unique by construction.
const APPS = [
  { dir: "aadhyatmik", name: "Aadhyatmik", short: "Aadhyatmik", glyph: "ॐ", theme: "#7c3aed", desc: "Sovereign contemplative runtime shell." },
  { dir: "film", name: "Film", short: "Film", glyph: "F", theme: "#dc2626", desc: "Film production runtime shell." },
  { dir: "kbs", name: "KBS Knowledge", short: "KBS", glyph: "K", theme: "#0891b2", desc: "Governed knowledge runtime shell." },
  { dir: "maataa", name: "Maataa", short: "Maataa", glyph: "M", theme: "#ea580c", desc: "Maataa OS core runtime shell." },
  { dir: "pedagogy", name: "Gurukul Pedagogy", short: "Gurukul", glyph: "G", theme: "#16a34a", desc: "Pedagogy runtime shell." },
  { dir: "system", name: "System", short: "System", glyph: "S", theme: "#475569", desc: "System operations runtime shell." },
  { dir: "tlp", name: "TLP", short: "TLP", glyph: "T", theme: "#ca8a04", desc: "TLP production-os runtime shell." },
];

const favicon = ({ theme, glyph }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="14" fill="${theme}"/>
  <text x="32" y="33" font-family="ui-sans-serif,system-ui,sans-serif" font-size="34" font-weight="700"
        fill="#ffffff" text-anchor="middle" dominant-baseline="central">${glyph}</text>
</svg>
`;

const manifest = (app) =>
  JSON.stringify(
    {
      $schema: "https://json.schemastore.org/web-manifest-combined.json",
      id: `/apps/${app.dir}/`,
      name: `MAATAA OS — ${app.name}`,
      short_name: app.short,
      description: app.desc,
      scope: `/apps/${app.dir}/`,
      start_url: "./index.html",
      display: "standalone",
      theme_color: app.theme,
      background_color: "#0b0f14",
      icons: [
        { src: "./favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
        { src: "./favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      ],
    },
    null,
    2,
  ) + "\n";

const cacheName = (app) => `maataa-${app.dir}-v1`;

const serviceWorker = (app) =>
  `// Isolated service worker for the ${app.name} app.
// Scope: /apps/${app.dir}/ — its own cache, never shared with other apps.
const CACHE = "${cacheName(app)}";
const SCOPE = "/apps/${app.dir}/";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./favicon.svg"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Drop only THIS app's stale caches; leave other apps' caches untouched (isolation).
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith("maataa-${app.dir}-") && k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Only serve requests inside this app's isolated scope.
  if (!url.pathname.startsWith(SCOPE)) return;
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
        if (res.ok && event.request.method === "GET") cache.put(event.request, res.clone());
        return res;
      })),
    ),
  );
});
`;

const indexHtml = (app) =>
  `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MAATAA OS — ${app.name}</title>
  <meta name="theme-color" content="${app.theme}" />
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
  <link rel="manifest" href="./manifest.webmanifest" />
</head>
<body>
  <div id="root"></div>
  <!-- Isolated scope: /apps/${app.dir}/ — shared runtimes are imported, not duplicated. -->
  <script type="module" src="./index.tsx"></script>
  <script>
    // Register this app's isolated service worker (cache "${cacheName(app)}").
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js", { scope: "./" }));
    }
  </script>
</body>
</html>
`;

let count = 0;
for (const app of APPS) {
  const base = join(root, "apps", app.dir);
  writeFileSync(join(base, "favicon.svg"), favicon(app), "utf8");
  writeFileSync(join(base, "manifest.webmanifest"), manifest(app), "utf8");
  writeFileSync(join(base, "sw.js"), serviceWorker(app), "utf8");
  writeFileSync(join(base, "index.html"), indexHtml(app), "utf8");
  count += 1;
}

// uniqueness self-check
const ids = new Set(APPS.map((a) => `/apps/${a.dir}/`));
const themes = new Set(APPS.map((a) => a.theme));
const glyphs = new Set(APPS.map((a) => a.glyph));
const caches = new Set(APPS.map((a) => cacheName(a)));
if ([ids, themes, glyphs, caches].some((s) => s.size !== APPS.length)) {
  throw new Error("PWA uniqueness violated: ids/themes/glyphs/caches must all be unique per app");
}

console.log(`PWA entries generated for ${count} apps (unique id/theme/favicon/cache + isolated sw.js each): ${APPS.map((a) => a.dir).join(", ")}`);
