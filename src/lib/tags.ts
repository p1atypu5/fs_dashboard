import { sortWordsByDate, type DisplayWord } from "./lastWords";
import { slugifyValue } from "./slugs";

export type TagDirectoryEntry = {
  name: string;
  slug: string;
  count: number;
  words: DisplayWord[];
};

export function buildTagDirectory(words: DisplayWord[]) {
  const tagsByName = new Map<string, DisplayWord[]>();

  for (const word of words) {
    for (const tag of word.tags) {
      const existingWords = tagsByName.get(tag);

      if (existingWords) {
        existingWords.push(word);
      } else {
        tagsByName.set(tag, [word]);
      }
    }
  }

  const slugCounts = new Map<string, number>();

  return [...tagsByName.entries()]
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB, "ru"))
    .map(([name, taggedWords]) => {
      const baseSlug = slugifyValue(name, "tag");
      const collisionIndex = slugCounts.get(baseSlug) ?? 0;
      const slug = collisionIndex === 0 ? baseSlug : `${baseSlug}-${collisionIndex + 1}`;

      slugCounts.set(baseSlug, collisionIndex + 1);

      return {
        name,
        slug,
        count: taggedWords.length,
        words: sortWordsByDate(taggedWords),
      } satisfies TagDirectoryEntry;
    });
}

export function isRussianTag(tag: string) {
  return /[а-яё]/i.test(tag);
}

export function getTagHref(base: string, slug: string) {
  return `${base}reports/tags/${slug}/`;
}
