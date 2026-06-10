import { lipiCharacterMatrix } from "../../lipi-runtime/src/characters/character-matrix.ts";
import { gurukulPaths } from "../../lipi-runtime/src/learning/gurukul-paths.ts";
import { lipiLessons } from "../../lipi-runtime/src/learning/lipi-lessons.ts";
import { getLipiScriptById, listLipiScripts } from "../../lipi-runtime/src/registry/script-registry.ts";

export type LipiDashboardStatus = "PREVIEW_VERIFIED" | "BLOCKED";
export type LipiAccuracyState = "UNKNOWN" | "MEASURED_PREVIEW";

export type LipiPracticeAttempt = {
  anchorId: string;
  answer: string;
};

export type LipiDashboardLessonRow = {
  id: string;
  title: string;
  scriptId: string;
  scriptName: string;
  lessonStatus: string;
  pathCount: number;
  anchorCount: number;
  blocker: string | null;
};

export type LipiDashboardModel = {
  dashboard: "lipi-dashboard";
  status: LipiDashboardStatus;
  route: "/lipi-dashboard";
  title: "Lipi Dashboard";
  totals: {
    scripts: number;
    lessons: number;
    previewLessons: number;
    blockedLessons: number;
    paths: number;
    anchors: number;
  };
  progress: {
    previewPercent: number;
    blockedPercent: number;
  };
  accuracy: {
    state: LipiAccuracyState;
    attempts: number;
    correct: number;
    accuracyPercent: number | null;
    evidence: string;
  };
  rows: LipiDashboardLessonRow[];
  evidenceLinks: string[];
  blockers: string[];
  productionReady: false;
  phkdVerdict: "BLOCKED";
};

const DASHBOARD_ROUTE = "/lipi-dashboard";

export function buildLipiDashboard(attempts: LipiPracticeAttempt[] = []): LipiDashboardModel {
  const scripts = listLipiScripts();
  const lessons = [...lipiLessons];
  const paths = [...gurukulPaths];
  const previewLessons = lessons.filter((lesson) => lesson.status === "PREVIEW").length;
  const blockedLessons = lessons.filter((lesson) => lesson.status === "BLOCKED").length;
  const measured = measureAttempts(attempts);
  const blockers = [
    "local preview renderer only; no live deployment is claimed",
    "lesson progress is derived from seeded runtime lesson status, not learner completion telemetry",
    "accuracy is UNKNOWN unless explicit practice attempts are supplied",
    "global PHKD gates remain blocked; productionReady=false",
  ];

  if (lessons.length === 0) blockers.push("no Lipi lessons are available to render");
  if (blockedLessons > 0) blockers.push(`${blockedLessons} Lipi lesson(s) remain BLOCKED by evidence or approval requirements`);

  return {
    dashboard: "lipi-dashboard",
    status: lessons.length > 0 ? "PREVIEW_VERIFIED" : "BLOCKED",
    route: DASHBOARD_ROUTE,
    title: "Lipi Dashboard",
    totals: {
      scripts: scripts.length,
      lessons: lessons.length,
      previewLessons,
      blockedLessons,
      paths: paths.length,
      anchors: lipiCharacterMatrix.length,
    },
    progress: {
      previewPercent: percent(previewLessons, lessons.length),
      blockedPercent: percent(blockedLessons, lessons.length),
    },
    accuracy: measured,
    rows: lessons.map((lesson) => {
      const script = getLipiScriptById(lesson.scriptId);
      return {
        id: lesson.id,
        title: lesson.title,
        scriptId: lesson.scriptId,
        scriptName: script?.name ?? "UNKNOWN",
        lessonStatus: lesson.status,
        pathCount: paths.filter((path) => path.lessonIds.includes(lesson.id)).length,
        anchorCount: lipiCharacterMatrix.filter((anchor) => anchor.scriptId === lesson.scriptId).length,
        blocker: "blockedReason" in lesson ? lesson.blockedReason ?? null : null,
      };
    }),
    evidenceLinks: [
      "packages/lipi-runtime/src/learning/lipi-lessons.ts",
      "packages/lipi-runtime/src/learning/gurukul-paths.ts",
      "packages/lipi-runtime/src/characters/character-matrix.ts",
    ],
    blockers,
    productionReady: false,
    phkdVerdict: "BLOCKED",
  };
}

export function renderLipiDashboardHtml(model = buildLipiDashboard()): string {
  const rows = model.rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.scriptName)}</td><td>${escapeHtml(row.lessonStatus)}</td><td>${row.anchorCount}</td><td>${escapeHtml(row.blocker ?? "none")}</td></tr>`,
    )
    .join("");
  const blockers = model.blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join("");
  const accuracy = model.accuracy.accuracyPercent === null ? "UNKNOWN" : `${model.accuracy.accuracyPercent}%`;

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${model.title}</title>`,
    "</head>",
    "<body>",
    `<main data-dashboard="${model.dashboard}" data-status="${model.status}">`,
    `<h1>${model.title}</h1>`,
    `<p>FINAL_STATUS=${model.phkdVerdict}; PRODUCTION_READY=${String(model.productionReady).toUpperCase()}</p>`,
    `<section><h2>Learning Progress</h2><p>preview=${model.progress.previewPercent}%; blocked=${model.progress.blockedPercent}%</p></section>`,
    `<section><h2>Accuracy</h2><p>state=${model.accuracy.state}; accuracy=${accuracy}; attempts=${model.accuracy.attempts}</p></section>`,
    `<section><h2>Lessons</h2><table><thead><tr><th>id</th><th>title</th><th>script</th><th>status</th><th>anchors</th><th>blocker</th></tr></thead><tbody>${rows}</tbody></table></section>`,
    `<section><h2>Blockers</h2><ul>${blockers}</ul></section>`,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

export function lipiDashboardHealth() {
  const model = buildLipiDashboard();
  return {
    dashboard: model.dashboard,
    status: model.status,
    route: model.route,
    lessons: model.totals.lessons,
    previewLessons: model.totals.previewLessons,
    blockedLessons: model.totals.blockedLessons,
    accuracyState: model.accuracy.state,
    productionReady: false as const,
    phkdVerdict: "BLOCKED" as const,
    blockers: model.blockers,
  };
}

function measureAttempts(attempts: LipiPracticeAttempt[]): LipiDashboardModel["accuracy"] {
  if (attempts.length === 0) {
    return {
      state: "UNKNOWN",
      attempts: 0,
      correct: 0,
      accuracyPercent: null,
      evidence: "No learner attempt telemetry supplied; accuracy must remain UNKNOWN.",
    };
  }

  const correct = attempts.filter((attempt) => {
    const anchor = lipiCharacterMatrix.find((item) => item.id === attempt.anchorId);
    return Boolean(anchor?.transliteration && anchor.transliteration.toLowerCase() === attempt.answer.trim().toLowerCase());
  }).length;

  return {
    state: "MEASURED_PREVIEW",
    attempts: attempts.length,
    correct,
    accuracyPercent: percent(correct, attempts.length),
    evidence: "Accuracy is computed only from explicit supplied attempts; it is not production learner telemetry.",
  };
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
