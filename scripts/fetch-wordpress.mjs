import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_SITE_URL = "https://posledneeslovo.com";
const DEFAULT_OUTPUT = "data/wp-export/posts.latest.raw.json";

const args = parseArgs(process.argv.slice(2));
const siteUrl = stripTrailingSlash(args.site ?? DEFAULT_SITE_URL);
const limit = Number(args.limit ?? 20);
const after = args.after;
const output = args.output ?? DEFAULT_OUTPUT;

if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  throw new Error("--limit must be an integer from 1 to 100");
}

const posts = await fetchPosts({ siteUrl, limit, after });
const outputPath = path.resolve(process.cwd(), output);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(posts, null, 2) + "\n", "utf8");

console.log(`saved ${posts.length} post(s) to ${path.relative(process.cwd(), outputPath)}`);

async function fetchPosts({ siteUrl, limit, after }) {
  const url = new URL("/wp-json/wp/v2/posts", siteUrl);
  url.searchParams.set("per_page", String(limit));
  url.searchParams.set("_embed", "1");
  url.searchParams.set("status", "publish");
  if (after) {
    url.searchParams.set("modified_after", after);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`WordPress request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function stripTrailingSlash(value) {
  return value.replace(/\/$/, "");
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
