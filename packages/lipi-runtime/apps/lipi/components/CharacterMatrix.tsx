import { lipiCharacterMatrix } from "../../../src/characters/character-matrix";
import { GlyphCard } from "./GlyphCard";

export function CharacterMatrix() {
  return (
    <section>
      {lipiCharacterMatrix.map((character) => (
        <GlyphCard key={character.id} character={character} />
      ))}
    </section>
  );
}
