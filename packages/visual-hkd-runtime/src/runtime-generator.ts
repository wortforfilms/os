import type { RealityMatrixEntry, RuntimePackageSuggestion, VisualHKD } from "./types.ts";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "runtime";
}

function pascal(value: string): string {
  return slug(value)
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("");
}

export function generateRuntimeSuggestions(
  hkd: VisualHKD,
  existingRuntimePackages: string[] = []
): RuntimePackageSuggestion[] {
  return hkd.sections
    .filter((section) => ["runtime", "service", "feature", "dashboard"].includes(section.type))
    .map((section) => {
      const packageName = `@maataa/${slug(section.title).replace(/-panel$/, "")}`;
      const modelName = `${pascal(section.title)}State`;
      return {
        id: `runtime-${section.id}`,
        packageName,
        sourceSectionId: section.id,
        sourceImage: section.sourceImage,
        serviceContract: `${slug(section.title)}.service.ts`,
        apiRoute: `/api/${slug(section.title)}/*`,
        databaseModel: modelName,
        dashboardWidget: `${pascal(section.title)}Widget`,
        status: existingRuntimePackages.includes(packageName) ? "implemented" : "scaffolded",
        confidence: section.confidence
      };
    });
}

export function generateRealityMatrixEntries(hkd: VisualHKD, suggestions: RuntimePackageSuggestion[]): RealityMatrixEntry[] {
  return suggestions.map((suggestion) => ({
    id: `matrix-${suggestion.sourceSectionId}`,
    title: suggestion.packageName,
    status: suggestion.status,
    sourceImage: suggestion.sourceImage,
    sourceSectionId: suggestion.sourceSectionId,
    reason: suggestion.status === "implemented"
      ? "existing package was explicitly supplied by the caller"
      : "visual HKD generated a runtime suggestion; implementation evidence is not present"
  }));
}
