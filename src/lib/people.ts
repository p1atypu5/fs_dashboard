import { sortWordsByDate, type DisplayWord } from "./lastWords";
import { slugifyValue } from "./slugs";

export type PersonDirectoryEntry = {
  name: string;
  slug: string;
  count: number;
  words: DisplayWord[];
};

export function isRussianWord(word: DisplayWord) {
  return word.language === "ru" && !word.sourceUrl.includes("/en/");
}

export function buildPersonDirectory(words: DisplayWord[]) {
  const wordsByPerson = new Map<string, DisplayWord[]>();

  for (const word of words) {
    if (!isRussianWord(word)) {
      continue;
    }

    const existingWords = wordsByPerson.get(word.person);

    if (existingWords) {
      existingWords.push(word);
    } else {
      wordsByPerson.set(word.person, [word]);
    }
  }

  const slugCounts = new Map<string, number>();

  return [...wordsByPerson.entries()]
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB, "ru"))
    .map(([name, personWords]) => {
      const baseSlug = slugifyValue(name, "person");
      const collisionIndex = slugCounts.get(baseSlug) ?? 0;
      const slug = collisionIndex === 0 ? baseSlug : `${baseSlug}-${collisionIndex + 1}`;

      slugCounts.set(baseSlug, collisionIndex + 1);

      return {
        name,
        slug,
        count: personWords.length,
        words: sortWordsByDate(personWords),
      } satisfies PersonDirectoryEntry;
    });
}

export function getPersonHref(base: string, slug: string) {
  return `${base}reports/names/${slug}/`;
}
