import { appendFile, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CONTENT_DIR = path.join(process.cwd(), "src/content/last-words");

const russianMonthByName = {
  январь: "01",
  января: "01",
  февраль: "02",
  февраля: "02",
  март: "03",
  марта: "03",
  апрель: "04",
  апреля: "04",
  май: "05",
  мая: "05",
  июнь: "06",
  июня: "06",
  июль: "07",
  июля: "07",
  август: "08",
  августа: "08",
  сентябрь: "09",
  сентября: "09",
  октябрь: "10",
  октября: "10",
  ноябрь: "11",
  ноября: "11",
  декабрь: "12",
  декабря: "12",
};

const russianOrdinalDayByName = {
  первое: "1",
  второе: "2",
  третье: "3",
  четвертое: "4",
  четвёртое: "4",
  пятое: "5",
  шестое: "6",
  седьмое: "7",
  восьмое: "8",
  девятое: "9",
  десятое: "10",
  одиннадцатое: "11",
  двенадцатое: "12",
  тринадцатое: "13",
  четырнадцатое: "14",
  пятнадцатое: "15",
  шестнадцатое: "16",
  семнадцатое: "17",
  восемнадцатое: "18",
  девятнадцатое: "19",
  двадцатое: "20",
  "двадцать первое": "21",
  "двадцать второе": "22",
  "двадцать третье": "23",
  "двадцать четвертое": "24",
  "двадцать четвёртое": "24",
  "двадцать пятое": "25",
  "двадцать шестое": "26",
  "двадцать седьмое": "27",
  "двадцать восьмое": "28",
  "двадцать девятое": "29",
  тридцатое: "30",
  "тридцать первое": "31",
};

const args = parseArgs(process.argv.slice(2));
const inputFile = args.input;
const limit = Number(args.limit ?? 20);
const all = Boolean(args.all);
const dryRun = Boolean(args["dry-run"]);
const prune = Boolean(args.prune);
const logOutput = args["log-output"];
const logLimit = Number(args["log-limit"] ?? 1000);
const mode = args.mode ?? (prune ? "full" : "incremental");

if (!inputFile) {
  throw new Error("Missing --input. First save WordPress JSON with npm run fetch:wp.");
}

if (!all && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
  throw new Error("--limit must be an integer from 1 to 100, or pass --all");
}

if (!Number.isInteger(logLimit) || logLimit < 0) {
  throw new Error("--log-limit must be a non-negative integer");
}

const inputPosts = await readPostsFromFile(inputFile);
const posts = all ? inputPosts : inputPosts.slice(0, limit);
assertUniqueWordPressPosts(posts);
await mkdir(CONTENT_DIR, { recursive: true });

const existingByWordPressId = await readExistingEntries(CONTENT_DIR, { allowDuplicates: prune });
const importedWordPressIds = new Set(posts.map((post) => String(post.id)));
const results = [];

for (const post of posts) {
  const postLanguage = detectPostLanguage(post);
  const existingGroup = existingByWordPressId.get(String(post.id));
  const existing = selectExistingEntry(existingGroup, postLanguage);
  const frontmatter = createFrontmatter(post, existing);
  const fileName = `${post.id}-${frontmatter.language}.md`;
  const filePath = path.join(CONTENT_DIR, fileName);
  const content = formatContentFile(frontmatter, cleanContentHtml(post.content?.rendered ?? ""));

  results.push({
    id: post.id,
    title: post.title?.rendered ?? "",
    file: path.relative(process.cwd(), filePath),
    localSlug: frontmatter.localSlug,
    action: existing ? "update" : "create",
  });

  if (!dryRun) {
    await writeFile(filePath, content, "utf8");
    for (const oldFile of existingGroup?.files ?? []) {
      if (oldFile !== fileName) {
        await unlink(path.join(CONTENT_DIR, oldFile));
      }
    }
  }
}

if (prune) {
  for (const [wordpressId, existingGroup] of existingByWordPressId) {
    if (importedWordPressIds.has(wordpressId)) {
      continue;
    }

    const existing = existingGroup.primary;
    const filePath = path.join(CONTENT_DIR, existing.file);
    results.push({
      id: wordpressId,
      title: existing.frontmatter.title ?? existing.frontmatter.person ?? "",
      file: path.relative(process.cwd(), filePath),
      localSlug: existing.frontmatter.localSlug,
      action: "delete",
    });

    if (!dryRun) {
      for (const oldFile of existingGroup.files) {
        await unlink(path.join(CONTENT_DIR, oldFile));
      }
    }
  }
}

for (const result of results) {
  console.log(`${result.action}: ${result.file} (${result.id}) ${stripHtml(result.title)}`);
}

if (logOutput && !dryRun && results.length > 0) {
  await appendImportLog({
    output: logOutput,
    input: inputFile,
    mode,
    prune,
    limit: logLimit,
    results,
  });
}

console.log(`${dryRun ? "checked" : "imported"} ${results.length} post(s)`);

async function readPostsFromFile(file) {
  const source = await readFile(path.resolve(process.cwd(), file), "utf8");
  const data = JSON.parse(source);
  return Array.isArray(data) ? data : [data];
}

async function readExistingEntries(contentDir, { allowDuplicates = false } = {}) {
  const entriesByWordPressId = new Map();
  const duplicates = new Map();
  let files = [];

  try {
    files = await readdir(contentDir);
  } catch {
    return entriesByWordPressId;
  }

  for (const file of files.sort((a, b) => a.localeCompare(b))) {
    if (!file.endsWith(".md")) {
      continue;
    }

    const filePath = path.join(contentDir, file);
    const source = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(source);
    if (frontmatter.wordpressId) {
      const key = String(frontmatter.wordpressId);
      const entry = { file, frontmatter };
      const existingGroup = entriesByWordPressId.get(key);

      if (existingGroup) {
        existingGroup.entries.push(entry);
        existingGroup.files.push(file);
        duplicates.set(key, existingGroup.files);
        continue;
      }

      entriesByWordPressId.set(key, {
        primary: entry,
        entries: [entry],
        files: [file],
      });
    }
  }

  if (!allowDuplicates && duplicates.size > 0) {
    throw new Error(formatDuplicateWordPressIds("Existing content has duplicate wordpressId values", duplicates));
  }

  return entriesByWordPressId;
}

function selectExistingEntry(existingGroup, language) {
  if (!existingGroup) {
    return undefined;
  }

  return existingGroup.entries.find((entry) => entry.frontmatter.language === language)
    ?? existingGroup.entries.find((entry) => entry.file.endsWith(`-${language}.md`))
    ?? existingGroup.primary;
}

function assertUniqueWordPressPosts(posts) {
  const seen = new Map();
  const duplicates = new Map();

  for (const post of posts) {
    const key = String(post.id);
    const existing = seen.get(key);

    if (existing) {
      duplicates.set(key, [...(duplicates.get(key) ?? [existing]), post.slug ?? ""]);
      continue;
    }

    seen.set(key, post.slug ?? "");
  }

  if (duplicates.size > 0) {
    throw new Error(formatDuplicateWordPressIds("Input JSON has duplicate WordPress post ids", duplicates));
  }
}

function formatDuplicateWordPressIds(message, duplicates) {
  const details = [...duplicates.entries()]
    .map(([wordpressId, items]) => `- ${wordpressId}: ${items.join(", ")}`)
    .join("\n");

  return `${message}:\n${details}`;
}

async function appendImportLog({ output, input, mode, prune, limit, results }) {
  const outputPath = path.resolve(process.cwd(), output);
  const runId = new Date().toISOString();
  const lines = results.map((result) => JSON.stringify({
    runId,
    timestamp: new Date().toISOString(),
    mode,
    prune,
    action: result.action,
    wordpressId: Number(result.id),
    file: result.file,
    localSlug: result.localSlug,
    title: stripHtml(result.title),
    input,
  }));

  await mkdir(path.dirname(outputPath), { recursive: true });
  await appendFile(outputPath, `${lines.join("\n")}\n`, "utf8");

  if (limit > 0) {
    await trimImportLog(outputPath, limit);
  }
}

async function trimImportLog(outputPath, limit) {
  const source = await readFile(outputPath, "utf8");
  const lines = source.split("\n").filter(Boolean);

  if (lines.length <= limit) {
    return;
  }

  await writeFile(outputPath, `${lines.slice(-limit).join("\n")}\n`, "utf8");
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
  const language = detectPostLanguage(post);
  const originalLanguage = existingData.originalLanguage ?? language;

  const data = {
    wordpressId: post.id,
    wpSlug: post.slug,
    localSlug: existingData.localSlug ?? post.slug,
    translationGroupId: existingData.translationGroupId ?? String(post.id),
    language,
    originalLanguage,
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

function detectPostLanguage(post) {
  return detectEntryLanguage({
    title: stripHtml(post.title?.rendered ?? ""),
    contentHtml: cleanContentHtml(post.content?.rendered ?? ""),
    personDescription: post.acf?.opisanie_cheloveka,
    caseDescription: post.acf?.opisanie_proczessa,
  });
}

function detectEntryLanguage({ title, contentHtml, personDescription, caseDescription }) {
  const text = [
    title,
    stripHtml(contentHtml),
    personDescription,
    caseDescription,
  ]
    .filter(Boolean)
    .join(" ");
  const sample = text.slice(0, 20000);
  const cyrillicCount = (sample.match(/[А-Яа-яЁё]/g) ?? []).length;
  const latinCount = (sample.match(/[A-Za-z]/g) ?? []).length;

  if (latinCount === 0 && cyrillicCount === 0) {
    return "unknown";
  }

  return latinCount > cyrillicCount ? "en" : "ru";
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
  const sourceIndex = findLastIndex(paragraphs, (paragraph) => isSourceParagraph(paragraph));
  const candidateGroups = [];

  if (sourceIndex !== -1) {
    candidateGroups.push(paragraphs.slice(Math.max(0, sourceIndex - 8), sourceIndex).filter((paragraph) => !isSourceParagraph(paragraph)));
  }

  candidateGroups.push(paragraphs.slice(-12).filter((paragraph) => !isSourceParagraph(paragraph)));

  for (const candidates of candidateGroups) {
    const uniqueCandidates = uniqueValues(candidates);

    for (let index = uniqueCandidates.length - 1; index >= 0; index -= 1) {
      const parsedDate = parseStatementDate(uniqueCandidates[index]);
      if (parsedDate) {
        return parsedDate;
      }
    }
  }

  return undefined;
}

function findLastIndex(items, predicate) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index;
    }
  }

  return -1;
}

function isSourceParagraph(value) {
  return /(?:^|\s)(Источник|Source|Подробнее|More information|Фото|Photo)\s*:?/i.test(value);
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function getTextParagraphs(html) {
  return [...String(html).matchAll(/<p[\s\S]*?<\/p>/gi)]
    .map((match) => stripHtml(match[0]))
    .filter(Boolean);
}

function parseStatementDate(value) {
  return parseRussianStatementDate(value)
    ?? parseEnglishStatementDate(value)
    ?? parseNumericStatementDate(value)
    ?? parseIsoStatementDate(value);
}

function parseRussianStatementDate(value) {
  const dayMonthYearMatch = value.match(/\b(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря),?\s+(\d{3}\s*\d|\d{4})(?:\s+года?)?\b/i);

  if (dayMonthYearMatch) {
    const [, rawDay, rawMonth, rawYear] = dayMonthYearMatch;
    const month = russianMonthByName[rawMonth.toLowerCase()];

    if (!month) {
      return undefined;
    }

    return formatDateParts(rawYear, month, rawDay);
  }

  const textualDayMonthYearMatch = value.match(/(?:^|\s)(первое|второе|третье|четвертое|четвёртое|пятое|шестое|седьмое|восьмое|девятое|десятое|одиннадцатое|двенадцатое|тринадцатое|четырнадцатое|пятнадцатое|шестнадцатое|семнадцатое|восемнадцатое|девятнадцатое|двадцатое|двадцать первое|двадцать второе|двадцать третье|двадцать четвертое|двадцать четвёртое|двадцать пятое|двадцать шестое|двадцать седьмое|двадцать восьмое|двадцать девятое|тридцатое|тридцать первое)\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря),?\s+(\d{3}\s*\d|\d{4})(?:\s+года?)?(?:$|\s|[.,])/i);

  if (textualDayMonthYearMatch) {
    const [, rawDay, rawMonth, rawYear] = textualDayMonthYearMatch;
    const day = russianOrdinalDayByName[rawDay.toLowerCase()];
    const month = russianMonthByName[rawMonth.toLowerCase()];

    if (!day || !month) {
      return undefined;
    }

    return formatDateParts(rawYear, month, day);
  }

  const monthYearMatch = value.match(/(?:^|\s)(январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь)\s+(\d{3}\s*\d|\d{4})(?:\s+года?)?(?:$|\s|[.,])/i);

  if (monthYearMatch) {
    const [, rawMonth, rawYear] = monthYearMatch;
    const month = russianMonthByName[rawMonth.toLowerCase()];

    if (!month) {
      return undefined;
    }

    return formatMonthParts(rawYear, month);
  }

  return undefined;
}

function parseEnglishStatementDate(value) {
  const monthByName = {
    january: "01",
    february: "02",
    march: "03",
    april: "04",
    may: "05",
    june: "06",
    july: "07",
    august: "08",
    september: "09",
    october: "10",
    november: "11",
    december: "12",
  };
  const monthNames = Object.keys(monthByName).join("|");
  const monthFirstMatch = value.match(new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?[,]?\\s+(\\d{4})\\b`, "i"));

  if (monthFirstMatch) {
    const [, rawMonth, rawDay, rawYear] = monthFirstMatch;
    return formatDateParts(rawYear, monthByName[rawMonth.toLowerCase()], rawDay);
  }

  const dayFirstMatch = value.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})[,]?\\s+(\\d{4})\\b`, "i"));

  if (dayFirstMatch) {
    const [, rawDay, rawMonth, rawYear] = dayFirstMatch;
    return formatDateParts(rawYear, monthByName[rawMonth.toLowerCase()], rawDay);
  }

  return undefined;
}

function parseNumericStatementDate(value) {
  const match = value.match(/\b(\d{1,2})[./](\d{1,2})[./](\d{3}\s*\d|\d{4})\b/);

  if (!match) {
    return undefined;
  }

  const [, rawDay, rawMonth, rawYear] = match;
  return formatDateParts(rawYear, rawMonth, rawDay);
}

function parseIsoStatementDate(value) {
  const match = value.match(/\b(\d{3}\s*\d|\d{4})-(\d{1,2})-(\d{1,2})\b/);

  if (!match) {
    return undefined;
  }

  const [, rawYear, rawMonth, rawDay] = match;
  return formatDateParts(rawYear, rawMonth, rawDay);
}

function formatDateParts(rawYear, rawMonth, rawDay) {
  const year = Number(normalizeYear(rawYear));
  const month = Number(rawMonth);
  const day = Number(rawDay);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    year < 1900 ||
    year > 2100 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatMonthParts(rawYear, rawMonth) {
  const year = Number(normalizeYear(rawYear));
  const month = Number(rawMonth);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return undefined;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function normalizeYear(rawYear) {
  return String(rawYear).replace(/\s+/g, "");
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
