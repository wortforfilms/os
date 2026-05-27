import { tokenAnchors } from "./token-anchors";

export const consonantAnchors = Object.freeze(tokenAnchors.filter((anchor) => anchor.category === "CONSONANT"));
