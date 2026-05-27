import { transliterationMap } from "../../../src/phonetics/transliteration-map";

export function TransliterationPanel() {
  return <pre>{JSON.stringify(transliterationMap, null, 2)}</pre>;
}
