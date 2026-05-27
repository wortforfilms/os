import { tokenAnchors } from "./token-anchors";

export const vowelAnchors = Object.freeze(tokenAnchors.filter((anchor) => anchor.category === "VOWEL"));
