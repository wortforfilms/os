import { pronunciationRules } from "../phonetics/pronunciation-rules";

export function searchPhonetics(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return pronunciationRules.filter((rule) =>
    [rule.ipa, rule.transliteration, rule.soundClass, rule.rule]
      .some((value) => value.toLowerCase().includes(needle)),
  );
}
