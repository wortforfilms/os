// Resolution probes for the Knowledge/HKD cluster: each `resolves` a specific
// HKD PARTIAL/UNVERIFIED claim id, upgrading it to ACHIEVED ONLY when the probe
// passes against real artifacts. A probe must satisfy the FULL claim text, not
// an adjacent capability. Fail → the claim stays IN_PROGRESS (honest).
export const probes = [
  {
    id: "a-resolve-hkd-file-format",
    universe: "hkd-runtime",
    resolves: "c-hkd-file-format",
    futureMilestone: "HKD (.hkd) file format is real: files on disk conform to the VisualHKD shape (id/title/universe/sections/claims)",
    probe({ root, join, readFileSync, readdirSync }) {
      const dir = join(root, "hkd");
      const files = readdirSync(dir).filter((f) => f.endsWith(".hkd") && !f.startsWith("._"));
      let conforming = 0;
      for (const f of files) {
        let d;
        try {
          d = JSON.parse(readFileSync(join(dir, f), "utf8"));
        } catch {
          continue;
        }
        const ok =
          typeof d.id === "string" &&
          typeof d.title === "string" &&
          typeof d.universe === "string" &&
          (Array.isArray(d.sections) || Array.isArray(d.claims) || Array.isArray(d.nodes));
        if (ok) conforming += 1;
      }
      return {
        pass: files.length > 0 && conforming === files.length,
        evidence: `${conforming}/${files.length} .hkd files parse and conform to VisualHKD shape (id/title/universe + sections|claims|nodes)`,
      };
    },
  },
];
