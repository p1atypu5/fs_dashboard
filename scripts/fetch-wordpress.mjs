import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_SITE_URL = "https://posledneeslovo.com";
const DEFAULT_OUTPUT = "data/wp-export/posts.latest.raw.json";

const args = parseArgs(process.argv.slice(2));
const siteUrl = stripTrailingSlash(args.site ?? DEFAULT_SITE_URL);
const limit = Number(args.limit ?? 20);
const all = Boolean(args.all);
const delay = Number(args.delay ?? 1000);
const after = args.after;
const output = args.output ?? DEFAULT_OUTPUT;
const metaOutput = args["meta-output"];
const fetchedAt = new Date();

if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  throw new Error("--limit must be an integer from 1 to 100");
}

if (!Number.isInteger(delay) || delay < 0) {
  throw new Error("--delay must be a non-negative integer");
}

const posts = all
  ? await fetchAllPosts({ siteUrl, limit, after, delay })
  : (await fetchPosts({ siteUrl, limit, after, page: 1 })).items;
const outputPath = path.resolve(process.cwd(), output);
const metaPath = getMetaPath(outputPath);
const metaOutputPath = metaOutput ? path.resolve(process.cwd(), metaOutput) : metaPath;
const meta = {
  source: `${siteUrl}/wp-json/wp/v2/posts`,
  fetchedAt: fetchedAt.toISOString(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  posts: posts.length,
  output: path.relative(process.cwd(), outputPath),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(posts, null, 2) + "\n", "utf8");
await mkdir(path.dirname(metaOutputPath), { recursive: true });
await writeFile(metaOutputPath, JSON.stringify(meta, null, 2) + "\n", "utf8");

console.log(`saved ${posts.length} post(s) to ${path.relative(process.cwd(), outputPath)}`);
console.log(`saved fetch metadata to ${path.relative(process.cwd(), metaOutputPath)}`);

async function fetchAllPosts({ siteUrl, limit, after, delay }) {
  const posts = [];
  let totalPages = 1;

  for (let page = 1; page <= totalPages; page += 1) {
    const { items, pages } = await fetchPosts({ siteUrl, limit, after, page });
    totalPages = pages;
    posts.push(...items);
    console.log(`fetched page ${page}/${totalPages}: ${items.length} post(s)`);

    if (page < totalPages && delay > 0) {
      await sleep(delay);
    }
  }

  return posts;
}

async function fetchPosts({ siteUrl, limit, after, page }) {
  const url = new URL("/wp-json/wp/v2/posts", siteUrl);
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("page", String(page));
  url.searchParams.set("_embed", "1");
  url.searchParams.set("status", "publish");
  if (after) {
    url.searchParams.set("modified_after", after);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`WordPress request failed: ${response.status} ${response.statusText}`);
  }

  return {
    items: await response.json(),
    pages: Number(response.headers.get("x-wp-totalpages") ?? 1),
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function stripTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

function getMetaPath(outputPath) {
  if (/\.raw\.json$/i.test(outputPath)) {
    return outputPath.replace(/\.raw\.json$/i, ".meta.json");
  }

  return outputPath.replace(/\.json$/i, ".meta.json");
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
