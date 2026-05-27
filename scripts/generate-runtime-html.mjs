import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const inventoryPath = "data/html-prototype-inventory.json";
const themeLabPath = "data/theme-lab-runtime.json";
const outputDir = "release/runtime-html";
const evidencePath = "release/evidence/runtime-html-release.json";
const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const themeLab = JSON.parse(readFileSync(themeLabPath, "utf8"));

mkdirSync(outputDir, { recursive: true });
mkdirSync("release/evidence", { recursive: true });

const generatedAt = new Date().toISOString();

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugToTitle(value) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function list(items) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function badge(status) {
  const cls = status === "BLOCKED" ? "blocked" : status === "READY" ? "ready" : "preview";
  return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

const css = `
  :root {
    color-scheme: dark;
    --bg: #050816;
    --panel: rgba(11, 18, 36, 0.86);
    --panel-2: rgba(4, 12, 24, 0.94);
    --line: rgba(197, 198, 199, 0.16);
    --text: #edf5f2;
    --muted: #aebbb8;
    --gold: #d6a55c;
    --cyan: #66fcf1;
    --red: #ff9d9d;
    --green: #8df0b1;
    --purple: #c084fc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at 10% 0%, rgba(102, 252, 241, 0.14), transparent 30rem),
      radial-gradient(circle at 82% 8%, rgba(214, 165, 92, 0.14), transparent 32rem),
      radial-gradient(circle at 50% 52%, rgba(192, 132, 252, 0.1), transparent 34rem),
      var(--bg);
    color: var(--text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main { width: min(1320px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 44px; }
  a { color: inherit; }
  .hero, .panel, .card {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    box-shadow: 0 28px 90px rgba(0, 0, 0, 0.26);
  }
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
    gap: 24px;
    align-items: end;
    padding: 28px;
    min-height: 320px;
  }
  .kicker { margin: 0 0 8px; color: var(--gold); font-size: 12px; font-weight: 950; text-transform: uppercase; letter-spacing: .12em; }
  h1, h2, h3, p { margin-top: 0; }
  h1 { margin-bottom: 12px; color: white; font-size: clamp(38px, 7vw, 78px); line-height: .92; letter-spacing: 0; }
  h2, h3 { color: white; }
  p { color: var(--muted); line-height: 1.58; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(245px, 1fr)); gap: 14px; margin-top: 18px; }
  .matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; margin-top: 18px; }
  .card, .panel { padding: 18px; }
  .card h3 { margin-bottom: 8px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
  .pill, .badge {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 5px 9px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: rgba(255,255,255,.04);
    font-size: 11px;
    font-weight: 850;
    text-transform: uppercase;
  }
  .badge.blocked { color: var(--red); border-color: rgba(255, 157, 157, .42); background: rgba(82, 11, 18, .34); }
  .badge.preview { color: var(--cyan); border-color: rgba(102, 252, 241, .32); background: rgba(0, 194, 255, .08); }
  .badge.ready { color: var(--green); border-color: rgba(141, 240, 177, .35); background: rgba(10, 80, 46, .24); }
  .no-go { color: var(--red); border-color: rgba(255, 157, 157, .42); background: rgba(82, 11, 18, .32); }
  .index-link { text-decoration: none; }
  .index-link:hover .card { border-color: rgba(102,252,241,.45); transform: translateY(-1px); }
  .contract-title { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
  ul { margin: 10px 0 0; padding-left: 20px; color: var(--muted); }
  li { margin: 5px 0; }
  code { color: #9de8ff; }
  footer { margin-top: 24px; color: var(--muted); font-size: 12px; }
  @media (max-width: 760px) {
    .hero { grid-template-columns: 1fr; min-height: auto; }
    main { width: min(100vw - 20px, 1320px); padding-top: 16px; }
  }
`;

function pageShell(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(title)}</title>
    <style>${css}</style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>
`;
}

function prototypePage(prototype) {
  const body = `
    <section class="hero">
      <div>
        <p class="kicker">Maataa OS Runtime HTML</p>
        <h1>${escapeHtml(prototype.title)}</h1>
        <p>
          Governed runtime page generated from the absorbed prototype contract.
          This is a structured preview, not copied raw source HTML and not production proof.
        </p>
        <div class="meta">
          ${badge(prototype.status)}
          <span class="pill">${escapeHtml(prototype.surface)}</span>
          <span class="pill">${escapeHtml(prototype.lineCount)} source lines mapped</span>
          <span class="pill no-go">GOVERNED_PRODUCTION_NO_GO</span>
        </div>
      </div>
      <aside class="panel">
        <h2>Source Boundary</h2>
        <p><code>${escapeHtml(prototype.sourceFile)}</code></p>
        <p>Raw prototype files stay outside release runtime source. This page is generated from inventory metadata.</p>
      </aside>
    </section>
    <section class="matrix">
      ${[
        ["Frames", prototype.frames],
        ["Types", prototype.types],
        ["Schemas", prototype.schemas],
        ["Data Frames", prototype.dataFrames],
        ["Runtimes", prototype.runtimes],
        ["Workflows", prototype.workflows],
        ["UI", prototype.ui],
        ["Widgets", prototype.widgets]
      ].map(([label, items]) => `
        <article class="card">
          <div class="contract-title">
            <h3>${escapeHtml(label)}</h3>
            <span class="pill">${escapeHtml(items.length)}</span>
          </div>
          ${list(items)}
        </article>
      `).join("")}
    </section>
    <section class="panel" style="margin-top:18px">
      <h2>Governance</h2>
      <p>${escapeHtml(prototype.blockedReason || "This surface remains preview until connected to release evidence.")}</p>
      <div class="meta">
        <span class="pill no-go">PRODUCTION_READY=false</span>
        <span class="pill no-go">PHKD_VERDICT=BLOCKED</span>
      </div>
    </section>
    <footer><a href="./index.html">Back to runtime HTML index</a></footer>
  `;
  return pageShell(`Maataa Runtime HTML - ${prototype.title}`, body);
}

for (const prototype of inventory.prototypes) {
  writeFileSync(join(outputDir, `${prototype.id}.html`), prototypePage(prototype));
}

function focusPage(title, prototypes) {
  const body = `
    <section class="hero">
      <div>
        <p class="kicker">Maataa OS Runtime HTML</p>
        <h1>${escapeHtml(title)}</h1>
        <p>
          A focused governed view for the selected runtime surfaces. This page combines extracted contracts
          without promoting prototype claims to production readiness.
        </p>
        <div class="meta">
          <span class="pill">${escapeHtml(prototypes.length)} surfaces</span>
          <span class="pill no-go">PRODUCTION_READY=false</span>
          <span class="pill no-go">GOVERNED_PRODUCTION_NO_GO</span>
        </div>
      </div>
      <aside class="panel">
        <h2>PHKD Boundary</h2>
        <p>Services and features are visible as product surfaces, but commercial commitments and performance claims remain evidence-gated.</p>
      </aside>
    </section>
    <section class="grid">
      ${prototypes.map((prototype) => `
        <article class="card">
          <div class="contract-title">
            <h3>${escapeHtml(prototype.title)}</h3>
            ${badge(prototype.status)}
          </div>
          <p>${escapeHtml(prototype.blockedReason || "Preview surface awaiting release evidence.")}</p>
          <div class="meta">
            <span class="pill">${escapeHtml(prototype.sourceFile)}</span>
            <span class="pill">${escapeHtml(prototype.surface)}</span>
            <a class="pill" href="./${escapeHtml(prototype.id)}.html">Open detail</a>
          </div>
        </article>
      `).join("")}
    </section>
    <section class="matrix">
      ${prototypes.map((prototype) => `
        <article class="card">
          <h3>${escapeHtml(slugToTitle(prototype.id))} Contracts</h3>
          <p><strong>Frames:</strong> ${escapeHtml(prototype.frames.join(", "))}</p>
          <p><strong>Runtimes:</strong> ${escapeHtml(prototype.runtimes.join(", "))}</p>
          <p><strong>Widgets:</strong> ${escapeHtml(prototype.widgets.join(", "))}</p>
        </article>
      `).join("")}
    </section>
    <footer><a href="./index.html">Back to runtime HTML index</a></footer>
  `;
  return pageShell(`Maataa Runtime HTML - ${title}`, body);
}

const servicesAndFeatures = inventory.prototypes.filter((prototype) => ["services", "features"].includes(prototype.id));
writeFileSync(join(outputDir, "services_and_features.html"), focusPage("Services and Features", servicesAndFeatures));

function themeLabPage(runtime) {
  const body = `
    <section class="hero">
      <div>
        <p class="kicker">${escapeHtml(runtime.identity.product)}</p>
        <h1>${escapeHtml(runtime.identity.module)}</h1>
        <p>${escapeHtml(runtime.identity.tagline)} ${escapeHtml(runtime.identity.subtitle)}</p>
        <div class="meta">
          <span class="pill">${escapeHtml(runtime.themeFamilies[0].count)} themes</span>
          <span class="pill">${escapeHtml(runtime.runtimeFamilies.length)} runtime families</span>
          <span class="pill no-go">PRODUCTION_READY=false</span>
          <span class="pill no-go">${escapeHtml(runtime.governance.finalStatus)}</span>
        </div>
      </div>
      <aside class="panel">
        <h2>Active Stack</h2>
        ${list(runtime.activeThemeStack)}
      </aside>
    </section>

    <section class="grid">
      <article class="card">
        <h3>Top Navigation Runtime</h3>
        ${list(runtime.topNavigation.main)}
        <p><strong>Search:</strong> ${escapeHtml(runtime.topNavigation.searchPlaceholder)}</p>
        <p><strong>User:</strong> ${escapeHtml(runtime.topNavigation.activeUser.name)} / ${escapeHtml(runtime.topNavigation.activeUser.role)}</p>
      </article>
      <article class="card">
        <h3>Quick Stack Builder</h3>
        <p><strong>Formula:</strong> ${escapeHtml(runtime.quickStackBuilder.formula)}</p>
        ${list(runtime.quickStackBuilder.inputs.map((input) => `${input.runtime}: ${input.value}`))}
      </article>
      <article class="card">
        <h3>Live Preview Runtime</h3>
        <p><strong>Active Runtime:</strong> ${escapeHtml(runtime.livePreview.activeRuntime)}</p>
        <p><strong>Greeting:</strong> ${escapeHtml(runtime.livePreview.greeting)}</p>
        ${list(runtime.livePreview.navigation)}
      </article>
    </section>

    <section class="matrix">
      <article class="card">
        <h3>Theme Families</h3>
        ${list(runtime.themeFamilies.map((family) => `${family.label}: ${family.count}`))}
      </article>
      <article class="card">
        <h3>Runtime Filters</h3>
        ${list(runtime.filters)}
      </article>
      <article class="card">
        <h3>Runtime Families</h3>
        ${list(runtime.runtimeFamilies)}
      </article>
      <article class="card">
        <h3>CSS Variables</h3>
        ${list(runtime.cssVariables)}
      </article>
      <article class="card">
        <h3>Recommended Combinations</h3>
        ${list(runtime.recommendedCombinations.map((combo) => `${combo.name}: ${combo.purpose}`))}
      </article>
      <article class="card">
        <h3>Import / Export Runtime</h3>
        ${list(runtime.importExport.map((item) => `${item.label}: ${item.description}`))}
      </article>
      <article class="card">
        <h3>Footer Principles</h3>
        ${list(runtime.footerPrinciples.map((item) => `${item.label}: ${item.description}`))}
      </article>
      <article class="card">
        <h3>Missing Runtime Layers</h3>
        ${list(runtime.impliedMissingLayers)}
      </article>
      <article class="card">
        <h3>Design Language</h3>
        ${list(runtime.designLanguage)}
      </article>
    </section>

    <section class="panel" style="margin-top:18px">
      <h2>PHKD Honest Status</h2>
      <p><strong>ThemeLab:</strong> ${escapeHtml(runtime.governance.runtimeStatus)}</p>
      <p><strong>Repo Foundations:</strong> ${escapeHtml(runtime.governance.repoFoundationStatus)}</p>
      <p><strong>Full Adaptive Consciousness Runtime:</strong> ${escapeHtml(runtime.governance.fullAdaptiveConsciousnessRuntime)}</p>
      <div class="meta">
        <span class="pill no-go">PHKD_VERDICT=${escapeHtml(runtime.governance.phkdVerdict)}</span>
        <span class="pill no-go">FINAL_STATUS=${escapeHtml(runtime.governance.finalStatus)}</span>
      </div>
    </section>
    <footer><a href="./index.html">Back to runtime HTML index</a></footer>
  `;
  return pageShell("Maataa Runtime HTML - ThemeLab", body);
}

writeFileSync(join(outputDir, "theme_lab.html"), themeLabPage(themeLab));

const indexBody = `
  <section class="hero">
    <div>
      <p class="kicker">Maataa OS Runtime HTML</p>
      <h1>Absorbed Prototype Runtime Index</h1>
      <p>
        Thirteen local HTML prototypes have been converted into governed runtime HTML pages.
        These pages expose frames, types, schemas, data frames, runtimes, workflows, UI, and widgets without promoting raw prototypes to production.
      </p>
      <div class="meta">
        <span class="pill">${escapeHtml(inventory.counts.files)} files</span>
        <span class="pill">${escapeHtml(inventory.counts.sourceLines)} source lines mapped</span>
        <span class="pill no-go">PRODUCTION_READY=false</span>
        <span class="pill no-go">GOVERNED_PRODUCTION_NO_GO</span>
      </div>
    </div>
    <aside class="panel">
      <h2>PHKD Boundary</h2>
      <p>Generated from <code>${escapeHtml(inventoryPath)}</code>. Raw HTML remains local-only. Evidence remains blocked until hardware, release signing, quorum, and rollback gates pass.</p>
    </aside>
  </section>
  <section class="grid">
    <a class="index-link" href="./theme_lab.html">
      <article class="card">
        <div class="contract-title">
          <h3>ThemeLab</h3>
          ${badge("PREVIEW")}
        </div>
        <p>Digital Gurukul theme runtime with stack builder, CSS variables, live preview, tokens, and PHKD blockers.</p>
        <div class="meta">
          <span class="pill">67 themes</span>
          <span class="pill">11 families</span>
        </div>
      </article>
    </a>
  </section>
  <section class="grid">
    ${inventory.prototypes.map((prototype) => `
      <a class="index-link" href="./${escapeHtml(prototype.id)}.html">
        <article class="card">
          <div class="contract-title">
            <h3>${escapeHtml(slugToTitle(prototype.id))}</h3>
            ${badge(prototype.status)}
          </div>
          <p>${escapeHtml(prototype.title)}</p>
          <div class="meta">
            <span class="pill">${escapeHtml(prototype.surface)}</span>
            <span class="pill">${escapeHtml(prototype.lineCount)} lines</span>
          </div>
        </article>
      </a>
    `).join("")}
  </section>
`;

writeFileSync(join(outputDir, "index.html"), pageShell("Maataa Runtime HTML Index", indexBody));

const manifest = {
  schema: "maataa.runtime-html.manifest.v1",
  generatedAt,
  source: inventoryPath,
  outputDir,
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  rawHtmlCopied: false,
  pages: [
    { id: "index", path: "release/runtime-html/index.html", status: "PREVIEW" },
    { id: "theme_lab", path: "release/runtime-html/theme_lab.html", status: "PREVIEW" },
    { id: "services_and_features", path: "release/runtime-html/services_and_features.html", status: "PREVIEW" },
    ...inventory.prototypes.map((prototype) => ({
      id: prototype.id,
      sourceFile: prototype.sourceFile,
      path: `release/runtime-html/${prototype.id}.html`,
      status: prototype.status
    }))
  ],
  activeBlockers: inventory.governance.activeBlockers,
  themeLabBlockers: themeLab.governance.activeBlockers,
  noFakeClaims: true
};

writeFileSync(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(evidencePath, `${JSON.stringify({
  schema: "maataa.runtime-html.evidence.v1",
  generatedAt,
  artifact: "release/runtime-html/manifest.json",
  pageCount: manifest.pages.length,
  prototypePageCount: inventory.prototypes.length,
  themeLabPage: "release/runtime-html/theme_lab.html",
  indexPage: "release/runtime-html/index.html",
  productionReady: false,
  phkdVerdict: "BLOCKED",
  finalStatus: "GOVERNED_PRODUCTION_NO_GO",
  rawHtmlCopied: false,
  noFakeClaims: true,
  activeBlockers: inventory.governance.activeBlockers
}, null, 2)}\n`);

console.log(`RUNTIME_HTML_GENERATED=${manifest.pages.length}`);
console.log("OUTPUT=release/runtime-html");
console.log("FINAL_STATUS=GOVERNED_PRODUCTION_NO_GO");
