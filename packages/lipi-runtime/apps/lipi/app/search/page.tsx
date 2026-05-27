import { searchLipiScripts } from "../../../../src/search/lipi-search";

export default function SearchPage() {
  return <pre>{JSON.stringify(searchLipiScripts("brahmi"), null, 2)}</pre>;
}
