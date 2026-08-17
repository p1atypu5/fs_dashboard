import assert from "node:assert/strict";
import {
  normalizeFeaturedImage,
  parseFeaturedImageFromMarkdown,
  validateFeaturedImage,
} from "./wordpress-featured-image.mjs";

const normalized = normalizeFeaturedImage(
  {
    source_url: "https://posledneeslovo.com/wp-content/uploads/example.jpg",
    alt_text: "  Example  ",
    mime_type: "image/jpeg",
    media_details: {
      width: "1200",
      height: "800",
      filesize: "34567",
    },
  },
  "Fallback title",
);

assert.deepEqual(normalized, {
  url: "https://posledneeslovo.com/wp-content/uploads/example.jpg",
  alt: "Example",
  mimeType: "image/jpeg",
  width: 1200,
  height: 800,
  sizeBytes: 34567,
});

assert.deepEqual(
  normalizeFeaturedImage(
    {
      source_url: "https://posledneeslovo.com/wp-content/uploads/numeric.jpg",
      media_details: { width: 640, height: 480, filesize: 12345 },
    },
    "Numeric image",
  ),
  {
    url: "https://posledneeslovo.com/wp-content/uploads/numeric.jpg",
    alt: "Numeric image",
    width: 640,
    height: 480,
    sizeBytes: 12345,
  },
);

assert.equal(
  normalizeFeaturedImage(
    {
      source_url: "not a url",
      media_details: { width: "1200", height: "800", filesize: "34567" },
    },
    "Fallback title",
  ),
  undefined,
);

assert.deepEqual(
  normalizeFeaturedImage(
    {
      source_url: "https://posledneeslovo.com/wp-content/uploads/example.jpg",
      alt_text: "",
      media_details: {
        width: "not-a-number",
        height: -1,
        filesize: "",
      },
    },
    "Fallback title",
  ),
  {
    url: "https://posledneeslovo.com/wp-content/uploads/example.jpg",
    alt: "Fallback title",
  },
);

assert.deepEqual(
  validateFeaturedImage({
    url: "invalid",
    width: "1200",
    height: -1,
    sizeBytes: Number.POSITIVE_INFINITY,
  }),
  [
    "featuredImage.url: expected an absolute HTTP(S) URL",
    "featuredImage.width: expected a non-negative number",
    "featuredImage.height: expected a non-negative number",
    "featuredImage.sizeBytes: expected a non-negative number",
  ],
);

assert.deepEqual(validateFeaturedImage(normalized), []);
assert.deepEqual(validateFeaturedImage(undefined), []);

const invalidMarkdownImage = parseFeaturedImageFromMarkdown(`---
wordpressId: 20281
featuredImage:
  url: "invalid"
  width: "1200"
  height: "800"
  sizeBytes: "34567"
---

Text
`);

assert.deepEqual(validateFeaturedImage(invalidMarkdownImage), [
  "featuredImage.url: expected an absolute HTTP(S) URL",
  "featuredImage.width: expected a non-negative number",
  "featuredImage.height: expected a non-negative number",
  "featuredImage.sizeBytes: expected a non-negative number",
]);

console.log("WordPress featured image normalization ok");
