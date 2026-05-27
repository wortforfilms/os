import type { AamJantaaLanguageCode } from "../types/aam-jantaa";
import { languageInterfaceMatrix } from "../data/language-interface-matrix";

export function getLanguageMode(code: AamJantaaLanguageCode) {
  return languageInterfaceMatrix.languages.find((language) => language.code === code) ?? languageInterfaceMatrix.languages[0];
}

export function getSupportedLanguageCodes(): AamJantaaLanguageCode[] {
  return languageInterfaceMatrix.languages.map((language) => language.code);
}
