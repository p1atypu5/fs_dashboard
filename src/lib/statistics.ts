import { isCountryValue } from "./countries";
import type { DisplayWord } from "./lastWords";
import {
  getEnglishWorkingWords,
  getRussianWorkingWords,
  isEnglishWorkingWord,
} from "./queries";

export type HomeStatistics = {
  wordsCount: number;
  russianWordsCount: number;
  englishWordsCount: number;
  peopleCount: number;
  countriesCount: number;
  countries: string[];
  russianWords: DisplayWord[];
  englishWords: DisplayWord[];
  canonicalWords: DisplayWord[];
};

export { isEnglishWorkingWord as isEnglishWord };

export function calculateHomeStatistics(words: DisplayWord[]): HomeStatistics {
  const russianWords = getRussianWorkingWords(words);
  const englishWords = getEnglishWorkingWords(words);
  const canonicalWords = [...russianWords, ...englishWords];
  const countries = [
    ...new Set(russianWords.map((word) => word.country).filter(isCountryValue)),
  ].sort((a, b) => a.localeCompare(b, "ru"));

  return {
    wordsCount: canonicalWords.length,
    russianWordsCount: russianWords.length,
    englishWordsCount: englishWords.length,
    peopleCount: new Set(russianWords.map((word) => word.person)).size,
    countriesCount: countries.length,
    countries,
    russianWords,
    englishWords,
    canonicalWords,
  };
}
