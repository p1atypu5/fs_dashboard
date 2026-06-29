import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CONTENT_DIR = path.join(process.cwd(), "src/content/last-words");
const EXPECTATIONS_FILE = path.join(process.cwd(), "scripts/statistics-expectations.json");
const NON_COUNTRY_VALUES = new Set([
  "Без рубрики",
  "Дагестан",
  "Ингушетия",
  "Каракалпакстан",
  "Карачаево-Черкесия",
  "Карелия",
  "Крым",
  "Crimea",
  "Karelia",
]);

const expectations = JSON.parse(await readFile(EXPECTATIONS_FILE, "utf8"));
const entries = await readContentEntries(CONTENT_DIR);
const stats = calculateStatistics(entries);
const unexpectedCopyFiles = entries
  .map((entry) => entry.file)
  .filter((file) => / \d+\.md$/.test(file));

assert.deepEqual(unexpectedCopyFiles, [], "Content directory contains accidental numbered copies");
assert.equal(stats.wordsCount, expectations.wordsCount, "canonical words count changed");
assert.equal(stats.russianWordsCount, expectations.russianWordsCount, "Russian words count changed");
assert.equal(stats.englishWordsCount, expectations.englishWordsCount, "English words count changed");
assert.equal(stats.peopleCount, expectations.peopleCount, "Russian people count changed");
assert.deepEqual(stats.countries, expectations.countries, "Russian country list changed");

console.log(
  [
    `statistics ok: ${stats.wordsCount} word(s)`,
    `${stats.russianWordsCount} ru`,
    `${stats.englishWordsCount} en`,
    `${stats.peopleCount} people`,
    `${stats.countries.length} countries`,
  ].join(", "),
);

async function readContentEntries(contentDir) {
  const files = (await readdir(contentDir))
    .filter((file) => file.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));

  const entries = [];

  for (const file of files) {
    const source = await readFile(path.join(contentDir, file), "utf8");
    const frontmatter = parseFrontmatter(source);
    entries.push({
      file,
      country: frontmatter.country,
      language: frontmatter.language,
      person: frontmatter.person,
      sourceUrl: frontmatter.sourceUrl,
    });
  }

  return entries;
}

function calculateStatistics(entries) {
  const russianWords = entries.filter(isRussianWord);
  const englishWords = entries.filter(isEnglishWord);
  const canonicalWords = [...russianWords, ...englishWords];
  const countries = [
    ...new Set(russianWords.map((word) => word.country).filter(isCountryValue)),
  ].sort((a, b) => a.localeCompare(b, "ru"));

  return {
    wordsCount: canonicalWords.length,
    russianWordsCount: russianWords.length,
    englishWordsCount: englishWords.length,
    peopleCount: new Set(russianWords.map((word) => word.person)).size,
    countries,
  };
}

function isRussianWord(word) {
  return word.language === "ru" && !word.sourceUrl.includes("/en/");
}

function isEnglishWord(word) {
  return word.language === "en" && word.sourceUrl.includes("/en/");
}

function isCountryValue(value) {
  return Boolean(value && !NON_COUNTRY_VALUES.has(value));
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

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}
