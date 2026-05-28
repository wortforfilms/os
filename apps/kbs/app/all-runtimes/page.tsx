import React from "react";
import { kbsRuntimeBoard, summarizeKbsRuntimeBoard } from "../../../../packages/kbs-runtime/src";
import { KbsShell } from "../../components/KbsShell";

export default function AllRuntimesPage() {
  const summary = summarizeKbsRuntimeBoard();
  const families = [...new Set(kbsRuntimeBoard.map((runtime) => runtime.family))];
  return (
    <KbsShell active="All Runtimes">
      <section>
        <h2>All Runtimes Board</h2>
        <p>{summary.totalRuntimes} runtimes. Health score {summary.healthScore}%. Final status {summary.finalStatus}.</p>
      </section>
      {families.map((family) => (
        <section key={family}>
          <h2>{family}</h2>
          <div className="kbs-card-grid">
            {kbsRuntimeBoard.filter((runtime) => runtime.family === family).map((runtime) => (
              <article key={runtime.id}>
                <strong>{runtime.id.toString().padStart(2, "0")} {runtime.name}</strong>
                <p>{runtime.status} {runtime.uptime ? `${runtime.uptime}% uptime` : "No uptime claimed"}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
    </KbsShell>
  );
}
