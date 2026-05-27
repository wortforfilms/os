import type { LipiCharacterRecord } from "../../../src/types/character";

export function GlyphCard({ character }: { character: LipiCharacterRecord }) {
  return (
    <article className="lipi-card">
      <strong>{character.glyph}</strong>
      <span>{character.transliteration ?? character.token}</span>
      <small>{character.anchorStatus}</small>
    </article>
  );
}
