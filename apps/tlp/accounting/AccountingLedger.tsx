import type { LedgerLine } from "../types";

const defaultLines: LedgerLine[] = [
  { code: "100", label: "crew", budget: 1200000, committed: 860000, actual: 420000 },
  { code: "210", label: "locations", budget: 450000, committed: 310000, actual: 120000 },
  { code: "330", label: "equipment", budget: 780000, committed: 690000, actual: 515000 },
];

export function AccountingLedger({ lines = defaultLines }: { lines?: LedgerLine[] }) {
  const committed = lines.reduce((total, line) => total + line.committed, 0);
  const budget = lines.reduce((total, line) => total + line.budget, 0);

  return (
    <section className="accounting-ledger">
      <h2>AccountingLedger</h2>
      <p>{Math.round((committed / budget) * 100)}% committed against approved budget.</p>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Line</th>
            <th>Budget</th>
            <th>Committed</th>
            <th>Actual</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.code}>
              <td>{line.code}</td>
              <td>{line.label}</td>
              <td>{line.budget}</td>
              <td>{line.committed}</td>
              <td>{line.actual}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
