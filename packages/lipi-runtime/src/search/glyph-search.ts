import { lipiCharacterMatrix } from "../characters/character-matrix";

export function searchGlyphs(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return lipiCharacterMatrix.filter((character) =>
    [character.token, character.glyph, character.transliteration, character.ipa]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)),
  );
}
