import assert from "node:assert/strict";
import {
  getFilesToRemoveAfterImport,
  isAllowedTransitionalDuplicate,
} from "./content-duplicates.mjs";

const sourceUrl = "https://posledneeslovo.com/en/example/";
const transitionalEntries = [
  {
    file: "123-en.md",
    frontmatter: { language: "en", sourceUrl },
  },
  {
    file: "123-ru.md",
    frontmatter: { language: "ru", sourceUrl },
  },
];

assert.equal(
  isAllowedTransitionalDuplicate(transitionalEntries.map((entry) => entry.frontmatter)),
  true,
);
assert.deepEqual(getFilesToRemoveAfterImport(transitionalEntries, "123-en.md"), []);
assert.deepEqual(
  getFilesToRemoveAfterImport(transitionalEntries, "123-en.md", { prune: true }),
  ["123-ru.md"],
);

assert.equal(
  isAllowedTransitionalDuplicate([
    { language: "en", sourceUrl },
    { language: "en", sourceUrl },
  ]),
  false,
);
assert.equal(
  isAllowedTransitionalDuplicate([
    { language: "en", sourceUrl },
    { language: "ru", sourceUrl: "https://posledneeslovo.com/en/other/" },
  ]),
  false,
);
assert.equal(
  isAllowedTransitionalDuplicate([
    { language: "en", sourceUrl: "https://posledneeslovo.com/example/" },
    { language: "ru", sourceUrl: "https://posledneeslovo.com/example/" },
  ]),
  false,
);

assert.deepEqual(
  getFilesToRemoveAfterImport(
    [{ file: "456-en.md", frontmatter: { language: "en", sourceUrl } }],
    "456-ru.md",
  ),
  ["456-en.md"],
);

console.log("content duplicate handling ok");
