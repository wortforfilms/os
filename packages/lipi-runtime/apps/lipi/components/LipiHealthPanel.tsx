import { lipiGovernance } from "../../../src/governance/lipi-governance";

export function LipiHealthPanel() {
  return (
    <section>
      <h2>Lipi Health</h2>
      <p>{lipiGovernance.finalStatus}</p>
      <p>Production ready: false</p>
    </section>
  );
}
