import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CONTENT_DIR = path.join(process.cwd(), "src/content/last-words");

const args = parseArgs(process.argv.slice(2));
const inputFile = args.input;
const limit = Number(args.limit ?? 20);
const all = Boolean(args.all);
const dryRun = Boolean(args["dry-run"]);

if (!inputFile) {
  throw new Error("Missing --input. First save WordPress JSON with npm run fetch:wp.");
}

if (!all && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
  throw new Error("--limit must be an integer from 1 to 100, or pass --all");
}

const inputPosts = await readPostsFromFile(inputFile);
const posts = all ? inputPosts : inputPosts.slice(0, limit);
await mkdir(CONTENT_DIR, { recursive: true });

const existingByWordPressId = await readExistingEntries(CONTENT_DIR);
const results = [];

for (const post of posts) {
  const existing = existingByWordPressId.get(String(post.id));
  const frontmatter = createFrontmatter(post, existing);
  const fileName = `${post.id}-${frontmatter.language}.md`;
  const filePath = path.join(CONTENT_DIR, fileName);
  const content = formatContentFile(frontmatter, cleanContentHtml(post.content?.rendered ?? ""));

  results.push({
    id: post.id,
    title: post.title?.rendered ?? "",
    file: path.relative(process.cwd(), filePath),
    action: existing ? "update" : "create",
  });

  if (!dryRun) {
    await writeFile(filePath, content, "utf8");
  }
}

for (const result of results) {
  console.log(`${result.action}: ${result.file} (${result.id}) ${stripHtml(result.title)}`);
}

console.log(`${dryRun ? "checked" : "imported"} ${results.length} post(s)`);

async function readPostsFromFile(file) {
  const source = await readFile(path.resolve(process.cwd(), file), "utf8");
  const data = JSON.parse(source);
  return Array.isArray(data) ? data : [data];
}

async function readExistingEntries(contentDir) {
  const entries = new Map();
  let files = [];

  try {
    files = await readdir(contentDir);
  } catch {
    return entries;
  }

  for (const file of files) {
    if (!file.endsWith(".md")) {
      continue;
    }

    const filePath = path.join(contentDir, file);
    const source = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(source);
    if (frontmatter.wordpressId) {
      entries.set(String(frontmatter.wordpressId), { file, frontmatter });
    }
  }

  return entries;
}

function createFrontmatter(post, existing) {
  const existingData = existing?.frontmatter ?? {};
  const terms = (post._embedded?.["wp:term"] ?? []).flat();
  const categories = terms.filter((term) => term.taxonomy === "category");
  const tags = terms.filter((term) => term.taxonomy === "post_tag");
  const years = terms.filter((term) => term.taxonomy === "years");
  const featured = post._embedded?.["wp:featuredmedia"]?.[0];
  const title = stripHtml(post.title?.rendered ?? "");
  const contentHtml = cleanContentHtml(post.content?.rendered ?? "");
  const extractedStatementDate = extractStatementDate(contentHtml);

  const data = {
    wordpressId: post.id,
    wpSlug: post.slug,
    localSlug: existingData.localSlug ?? post.slug,
    translationGroupId: existingData.translationGroupId ?? String(post.id),
    language: existingData.language ?? "ru",
    originalLanguage: existingData.originalLanguage ?? existingData.language ?? "ru",
    isOriginal: existingData.isOriginal ?? true,
    sourceUrl: post.link,
    publishedAt: post.date,
    modifiedAt: post.modified,
    title,
    person: existingData.person ?? title,
    personDescription: post.acf?.opisanie_cheloveka || undefined,
    caseDescription: post.acf?.opisanie_proczessa || undefined,
    readingTime: post.acf?.vremya_chteniya || undefined,
    country: categories[0]?.name,
    period: years[0]?.name,
    tags: tags.map((tag) => tag.name),
    featuredImage: featured
      ? {
          url: featured.source_url,
          alt: featured.alt_text || title,
          mimeType: featured.mime_type || undefined,
          width: featured.media_details?.width || undefined,
          height: featured.media_details?.height || undefined,
          sizeBytes: featured.media_details?.filesize || undefined,
        }
      : undefined,
    court: existingData.court || undefined,
    city: existingData.city || undefined,
    statementDate: existingData.statementDate || extractedStatementDate || undefined,
    relatedWordIds: existingData.relatedWordIds ?? [],
  };

  return removeUndefined(data);
}

function formatContentFile(frontmatter, body) {
  return `---\n${formatYaml(frontmatter)}---\n\n${body.trim()}\n`;
}

function cleanContentHtml(html) {
  return String(html)
    .replace(/<p>\s*(Поделиться в соцсетях:|Share on social networks:)\s*<\/p>/gi, "")
    .replace(/<p>\s*<strong>\s*<div class="sfsi_widget[\s\S]*?<script>window\.addEventListener\("sfsi_functions_loaded"[\s\S]*?<\/script>\s*<\/strong>\s*<\/p>/gi, "")
    .replace(/<div class="sfsi_widget[\s\S]*?<script>window\.addEventListener\("sfsi_functions_loaded"[\s\S]*?<\/script>/gi, "");
}

function extractStatementDate(html) {
  const paragraphs = getTextParagraphs(html);
  const sourceIndex = paragraphs.findIndex((paragraph) => /(?:^|\s)(Источник|Source)\s*:/i.test(paragraph));

  if (sourceIndex === -1) {
    return undefined;
  }

  const candidates = paragraphs.slice(Math.max(0, sourceIndex - 5), sourceIndex);

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const parsedDate = parseRussianStatementDate(candidates[index]);
    if (parsedDate) {
      return parsedDate;
    }
  }

  return undefined;
}

function getTextParagraphs(html) {
  return [...String(html).matchAll(/<p[\s\S]*?<\/p>/gi)]
    .map((match) => stripHtml(match[0]))
    .filter(Boolean);
}

function parseRussianStatementDate(value) {
  const match = value.match(/(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})\s+года?/i);

  if (!match) {
    return undefined;
  }

  const [, rawDay, rawMonth, rawYear] = match;
  const monthByName = {
    января: "01",
    февраля: "02",
    марта: "03",
    апреля: "04",
    мая: "05",
    июня: "06",
    июля: "07",
    августа: "08",
    сентября: "09",
    октября: "10",
    ноября: "11",
    декабря: "12",
  };
  const month = monthByName[rawMonth.toLowerCase()];

  if (!month) {
    return undefined;
  }

  return `${rawYear}-${month}-${rawDay.padStart(2, "0")}`;
}

function formatYaml(value, indent = "") {
  return Object.entries(value)
    .map(([key, item]) => formatYamlEntry(key, item, indent))
    .join("");
}

function formatYamlEntry(key, value, indent) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `${indent}${key}: []\n`;
    }

    return `${indent}${key}:\n${value.map((item) => `${indent}  - ${formatYamlScalar(item)}\n`).join("")}`;
  }

  if (value && typeof value === "object") {
    return `${indent}${key}:\n${formatYaml(value, `${indent}  `)}`;
  }

  return `${indent}${key}: ${formatYamlScalar(value)}\n`;
}

function formatYamlScalar(value) {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(String(value));
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
  let currentArrayKey = null;

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if (currentArrayKey && line.startsWith("  - ")) {
      data[currentArrayKey].push(parseYamlScalar(line.slice(4)));
      continue;
    }

    currentArrayKey = null;
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue = ""] = match;
    if (rawValue === "") {
      currentArrayKey = key;
      data[key] = [];
      continue;
    }

    data[key] = parseYamlScalar(rawValue);
  }

  return data;
}

function parseYamlScalar(value) {
  const trimmed = value.trim();

  if (trimmed === "true") {
    return true;
  }
  if (trimmed === "false") {
    return false;
  }
  if (trimmed === "[]") {
    return [];
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
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

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ""));
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#8212;/g, "—")
    .replace(/&#171;/g, "«")
    .replace(/&#187;/g, "»")
    .replace(/\s+/g, " ")
    .trim();
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=");
    if (inlineValue !== undefined) {
      parsed[rawKey] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[rawKey] = true;
      continue;
    }

    parsed[rawKey] = next;
    index += 1;
  }

  return parsed;
}
