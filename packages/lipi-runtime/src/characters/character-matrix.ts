import { tokenAnchors } from "./token-anchors";

export const lipiCharacterMatrix = Object.freeze(tokenAnchors);

export function getCharactersForScript(scriptId: string) {
  return lipiCharacterMatrix.filter((character) => character.scriptId === scriptId);
}
