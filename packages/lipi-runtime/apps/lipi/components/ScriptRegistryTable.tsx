import { lipi426Master } from "../../../src/data/lipi-426-master";

export function ScriptRegistryTable() {
  return (
    <table>
      <tbody>
        {lipi426Master.slice(0, 12).map((script) => (
          <tr key={script.id}>
            <td>{script.isoCode}</td>
            <td>{script.name}</td>
            <td>{script.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
