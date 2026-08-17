const NUMERIC_FIELDS = ["width", "height", "sizeBytes"];

export function normalizeFeaturedImage(featured, fallbackAlt) {
  if (!featured || typeof featured !== "object") {
    return undefined;
  }

  const url = normalizeHttpUrl(featured.source_url);

  if (!url) {
    return undefined;
  }

  return removeUndefined({
    url,
    alt: normalizeOptionalString(featured.alt_text) ?? normalizeOptionalString(fallbackAlt),
    mimeType: normalizeOptionalString(featured.mime_type),
    width: normalizeNonNegativeNumber(featured.media_details?.width),
    height: normalizeNonNegativeNumber(featured.media_details?.height),
    sizeBytes: normalizeNonNegativeNumber(featured.media_details?.filesize),
  });
}

export function validateFeaturedImage(featuredImage) {
  if (featuredImage === undefined) {
    return [];
  }

  if (!featuredImage || typeof featuredImage !== "object" || Array.isArray(featuredImage)) {
    return ["featuredImage: expected an object"];
  }

  const errors = [];

  if (!normalizeHttpUrl(featuredImage.url)) {
    errors.push("featuredImage.url: expected an absolute HTTP(S) URL");
  }

  for (const field of ["alt", "mimeType"]) {
    const value = featuredImage[field];
    if (value !== undefined && typeof value !== "string") {
      errors.push(`featuredImage.${field}: expected a string`);
    }
  }

  for (const field of NUMERIC_FIELDS) {
    const value = featuredImage[field];
    if (value !== undefined && !isNonNegativeNumber(value)) {
      errors.push(`featuredImage.${field}: expected a non-negative number`);
    }
  }

  return errors;
}

export function parseFeaturedImageFromMarkdown(source) {
  if (!source.startsWith("---\n")) {
    return undefined;
  }

  const end = source.indexOf("\n---", 4);
  if (end === -1) {
    return undefined;
  }

  const lines = source.slice(4, end).split("\n");
  const featuredImageIndex = lines.findIndex((line) => line === "featuredImage:");

  if (featuredImageIndex === -1) {
    return undefined;
  }

  const featuredImage = {};

  for (const line of lines.slice(featuredImageIndex + 1)) {
    if (!line.startsWith("  ")) {
      break;
    }

    const match = line.match(/^  ([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue = ""] = match;
    featuredImage[key] = parseYamlScalar(rawValue);
  }

  return featuredImage;
}

function normalizeHttpUrl(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function normalizeOptionalString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeNonNegativeNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") {
    return undefined;
  }

  const normalized = typeof value === "string" ? value.trim() : value;
  if (normalized === "") {
    return undefined;
  }

  const number = Number(normalized);
  return isNonNegativeNumber(number) ? number : undefined;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parseYamlScalar(value) {
  const trimmed = value.trim();

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
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

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
