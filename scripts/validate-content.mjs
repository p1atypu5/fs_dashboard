import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { isAllowedTransitionalDuplicate } from "./content-duplicates.mjs";
import {
  parseFeaturedImageFromMarkdown,
  validateFeaturedImage,
} from "./wordpress-featured-image.mjs";

const CONTENT_DIR = path.join(process.cwd(), "src/content/last-words");

const entries = await readContentEntries(CONTENT_DIR);
const duplicateGroups = findDisallowedDuplicateWordPressIds(entries);
const invalidEntries = entries.filter((entry) => !Number.isInteger(entry.wordpressId));
const invalidFeaturedImages = entries.flatMap((entry) =>
  validateFeaturedImage(entry.featuredImage).map((error) => ({ file: entry.file, error })),
);

if (invalidEntries.length > 0 || duplicateGroups.length > 0 || invalidFeaturedImages.length > 0) {
  for (const entry of invalidEntries) {
    console.error(`invalid wordpressId: ${entry.file}`);
  }

  for (const group of duplicateGroups) {
    console.error(`duplicate wordpressId ${group.wordpressId}: ${group.files.join(", ")}`);
  }

  for (const { file, error } of invalidFeaturedImages) {
    console.error(`${file}: ${error}`);
  }

  throw new Error("Content validation failed");
}

console.log(`validated ${entries.length} content file(s): ids and featured images are consistent`);

async function readContentEntries(contentDir) {
  const files = (await readdir(contentDir))
    .filter((file) => file.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  const entries = [];

  for (const file of files) {
    const source = await readFile(path.join(contentDir, file), "utf8");
    const frontmatter = parseFrontmatter(source);
    entries.push({
      file: path.join("src/content/last-words", file),
      featuredImage: parseFeaturedImageFromMarkdown(source),
      language: frontmatter.language,
      sourceUrl: frontmatter.sourceUrl,
      wordpressId: frontmatter.wordpressId,
    });
  }

  return entries;
}

function findDisallowedDuplicateWordPressIds(entries) {
  const byWordPressId = new Map();

  for (const entry of entries) {
    if (!Number.isInteger(entry.wordpressId)) {
      continue;
    }

    const key = String(entry.wordpressId);
    const group = byWordPressId.get(key) ?? [];
    group.push(entry);
    byWordPressId.set(key, group);
  }

  return [...byWordPressId.entries()]
    .filter(([, group]) => group.length > 1 && !isAllowedTransitionalDuplicate(group))
    .map(([wordpressId, group]) => ({
      wordpressId,
      files: group.map((entry) => entry.file),
    }));
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) {
    return {};
  }

  const end = source.indexOf("\n---", 4);
  if (end === -1) {
    return {};
  }

  const lines = source.slice(4, end).split("\n");
  const data = {};

  for (const line of lines) {
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue = ""] = match;
    data[key] = parseYamlScalar(rawValue);
  }

  return data;
}

function parseYamlScalar(value) {
  const trimmed = value.trim();

  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}
