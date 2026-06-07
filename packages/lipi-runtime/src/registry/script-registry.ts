import { lipi426Master } from "../data/lipi-426-master.ts";

export function getLipiScriptById(id: string) {
  return lipi426Master.find((script) => script.id === id);
}

export function listLipiScripts() {
  return lipi426Master;
}
