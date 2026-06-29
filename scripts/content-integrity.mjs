import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CONTENT_DIR = path.join(process.cwd(), "src/content/last-words");
const BASELINE_FILE = path.join(process.cwd(), "scripts/content-integrity-baseline.json");
const MIN_TEXT_LENGTH = 20;
const MAX_SHRINK_RATIO = 0.7;
const MAX_CHANGED_HASHES = 25;
const MAX_MISSING_ENTRIES = 5;
const MAX_NEW_ENTRIES = 20;

const command = process.argv[2] ?? "--check";

if (command === "--update") {
  await updateBaseline();
} else if (command === "--check") {
  await checkBaseline();
} else {
  throw new Error(`Unknown content integrity command: ${command}`);
}

async function updateBaseline() {
  const metrics = await readContentMetrics();
  const baseline = {
    schemaVersion: 1,
    entries: Object.fromEntries(metrics.map((entry) => [entry.file, entry])),
  };

  await writeFile(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
  console.log(`content integrity baseline updated: ${metrics.length} entry(s)`);
}

async function checkBaseline() {
  const baseline = JSON.parse(await readFile(BASELINE_FILE, "utf8"));
  const expectedEntries = baseline.entries ?? {};
  const currentEntries = Object.fromEntries(
    (await readContentMetrics()).map((entry) => [entry.file, entry]),
  );
  const expectedFiles = Object.keys(expectedEntries).sort((a, b) => a.localeCompare(b));
  const currentFiles = Object.keys(currentEntries).sort((a, b) => a.localeCompare(b));
  const missingBaselineEntries = expectedFiles.filter((file) => !currentEntries[file]);
  const prunedTransitionalEntries = missingBaselineEntries.filter((file) =>
    isAllowedPrunedTransitionalEntry(expectedEntries[file]),
  );
  const missingEntries = missingBaselineEntries.filter(
    (file) => !isAllowedPrunedTransitionalEntry(expectedEntries[file]),
  );
  const newEntries = currentFiles.filter((file) => !expectedEntries[file]);
  const emptyEntries = currentFiles.filter((file) => currentEntries[file].textLength === 0);
  const shortEntries = currentFiles.filter((file) => currentEntries[file].textLength < MIN_TEXT_LENGTH);
  const changedEntries = [];
  const shortenedEntries = [];
  const wordShortenedEntries = [];

  for (const file of currentFiles) {
    const expected = expectedEntries[file];
    const current = currentEntries[file];

    if (!expected) {
      continue;
    }

    if (expected.textHash !== current.textHash) {
      changedEntries.push(file);
    }

    if (expected.textLength > 0 && current.textLength < expected.textLength * (1 - MAX_SHRINK_RATIO)) {
      shortenedEntries.push(file);
    }

    if (expected.wordCount > 0 && current.wordCount < expected.wordCount * (1 - MAX_SHRINK_RATIO)) {
      wordShortenedEntries.push(file);
    }
  }

  assert.deepEqual(formatList(emptyEntries), [], "Content entries with empty text");
  assert.deepEqual(formatList(shortEntries), [], `Content entries shorter than ${MIN_TEXT_LENGTH} characters`);
  assert.deepEqual(formatList(shortenedEntries), [], "Content entries shrank by more than 70%");
  assert.deepEqual(formatList(wordShortenedEntries), [], "Content entries lost more than 70% of words");
  assert.ok(
    missingEntries.length <= MAX_MISSING_ENTRIES,
    `Too many content entries are missing: ${missingEntries.length} > ${MAX_MISSING_ENTRIES}\n${formatList(missingEntries).join("\n")}`,
  );
  assert.ok(
    newEntries.length <= MAX_NEW_ENTRIES,
    `Too many new content entries: ${newEntries.length} > ${MAX_NEW_ENTRIES}\n${formatList(newEntries).join("\n")}`,
  );
  assert.ok(
    changedEntries.length <= MAX_CHANGED_HASHES,
    `Too many content entries changed: ${changedEntries.length} > ${MAX_CHANGED_HASHES}\n${formatList(changedEntries).join("\n")}`,
  );

  printWarning("missing entries", missingEntries);
  printWarning("pruned transitional entries", prunedTransitionalEntries);
  printWarning("new entries", newEntries);
  printWarning("changed entries", changedEntries);

  console.log(
    [
      `content integrity ok: ${currentFiles.length} entry(s)`,
      `${changedEntries.length} changed`,
      `${newEntries.length} new`,
      `${missingEntries.length} missing`,
      `${prunedTransitionalEntries.length} pruned transitional`,
    ].join(", "),
  );
}

async function readContentMetrics() {
  const files = (await readdir(CONTENT_DIR))
    .filter((file) => file.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b));
  const entries = [];

  for (const file of files) {
    const source = await readFile(path.join(CONTENT_DIR, file), "utf8");
    const { body, frontmatter } = parseMarkdownEntry(source);
    const cleanText = cleanContentText(body);

    entries.push({
      file,
      wordpressId: frontmatter.wordpressId,
      language: frontmatter.language,
      sourceUrl: frontmatter.sourceUrl,
      textHash: hashText(cleanText),
      textLength: cleanText.length,
      wordCount: countWords(cleanText),
    });
  }

  return entries;
}

function parseMarkdownEntry(source) {
  if (!source.startsWith("---\n")) {
    return { body: source, frontmatter: {} };
  }

  const end = source.indexOf("\n---", 4);
  if (end === -1) {
    return { body: source, frontmatter: {} };
  }

  return {
    body: source.slice(end + 4),
    frontmatter: parseFrontmatter(source.slice(4, end)),
  };
}

function parseFrontmatter(source) {
  const data = {};

  for (const line of source.split("\n")) {
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

function cleanContentText(value) {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function countWords(value) {
  if (!value) {
    return 0;
  }

  return value.split(/\s+/).filter(Boolean).length;
}

function isAllowedPrunedTransitionalEntry(entry) {
  return (
    entry?.language === "ru"
    && typeof entry.sourceUrl === "string"
    && entry.sourceUrl.includes("/en/")
  );
}

function formatList(values) {
  return values.slice(0, 20).map((value) => `- ${value}`);
}

function printWarning(label, values) {
  if (values.length === 0) {
    return;
  }

  console.warn(`content integrity warning: ${values.length} ${label}`);
  for (const item of formatList(values)) {
    console.warn(item);
  }
}
