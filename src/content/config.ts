import { defineCollection, z } from "astro:content";

const lastWords = defineCollection({
  type: "content",
  schema: z.object({
    wordpressId: z.number(),
    wpSlug: z.string(),
    localSlug: z.string(),
    translationGroupId: z.string(),
    language: z.string(),
    originalLanguage: z.string(),
    isOriginal: z.boolean(),
    sourceUrl: z.string().url(),
    publishedAt: z.string(),
    modifiedAt: z.string(),
    title: z.string(),
    person: z.string(),
    personDescription: z.string().optional(),
    caseDescription: z.string().optional(),
    readingTime: z.string().optional(),
    country: z.string().optional(),
    period: z.string().optional(),
    tags: z.array(z.string()).default([]),
    featuredImage: z
      .object({
        url: z.string().url(),
        alt: z.string().optional(),
      })
      .optional(),
    court: z.string().optional(),
    city: z.string().optional(),
    statementDate: z.string().optional(),
    relatedWordIds: z.array(z.number()).default([]),
  }),
});

export const collections = {
  "last-words": lastWords,
};
