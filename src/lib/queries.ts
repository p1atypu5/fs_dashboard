import type { DisplayWord } from "./lastWords";

type WordLanguageFields = Pick<DisplayWord, "language" | "sourceUrl">;

export function isRussianWorkingWord(word: WordLanguageFields) {
  return word.language === "ru" && !word.sourceUrl.includes("/en/");
}

export function isEnglishWorkingWord(word: WordLanguageFields) {
  return word.language === "en" && word.sourceUrl.includes("/en/");
}

export function getRussianWorkingWords(words: DisplayWord[]) {
  return words.filter(isRussianWorkingWord);
}

export function getEnglishWorkingWords(words: DisplayWord[]) {
  return words.filter(isEnglishWorkingWord);
}
