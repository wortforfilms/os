import { pronunciationRules } from "../../../src/phonetics/pronunciation-rules";

export function PhoneticPanel() {
  return <pre>{JSON.stringify(pronunciationRules, null, 2)}</pre>;
}
