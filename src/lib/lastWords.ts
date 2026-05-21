import type { CollectionEntry } from "astro:content";

export type LastWordEntry = CollectionEntry<"last-words">;

export type DisplayWord = {
  id: string;
  slug: string;
  title: string;
  person: string;
  caseName: string;
  court?: string;
  city?: string;
  country?: string;
  period?: string;
  date: string;
  sourceUrl: string;
  tags: string[];
  text: string;
  featuredImage?: {
    url: string;
    alt?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    sizeBytes?: number;
  };
  language: string;
  originalLanguage: string;
  isOriginal: boolean;
  statementDate?: string;
  personDescription?: string;
  caseDescription?: string;
  readingTime?: string;
};

export function toDisplayWord(entry: LastWordEntry): DisplayWord {
  return {
    id: entry.id,
    slug: entry.data.localSlug,
    title: entry.data.title,
    person: entry.data.person,
    caseName: entry.data.caseDescription ?? "Описание дела не заполнено",
    court: entry.data.court,
    city: entry.data.city,
    country: entry.data.country,
    period: entry.data.period,
    date: entry.data.publishedAt,
    sourceUrl: entry.data.sourceUrl,
    tags: entry.data.tags,
    text: entry.body,
    featuredImage: entry.data.featuredImage,
    language: entry.data.language,
    originalLanguage: entry.data.originalLanguage,
    isOriginal: entry.data.isOriginal,
    statementDate: entry.data.statementDate,
    personDescription: entry.data.personDescription,
    caseDescription: entry.data.caseDescription,
    readingTime: entry.data.readingTime,
  };
}

export function sortWordsByDate(words: DisplayWord[]) {
  return [...words].sort((a, b) => b.date.localeCompare(a.date));
}
