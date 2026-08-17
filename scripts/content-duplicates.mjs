export function isAllowedTransitionalDuplicate(entries) {
  const sourceUrls = new Set(entries.map((entry) => entry.sourceUrl));
  const languages = new Set(entries.map((entry) => entry.language));

  return (
    entries.length === 2
    && sourceUrls.size === 1
    && languages.size === entries.length
    && [...sourceUrls].every(
      (sourceUrl) => typeof sourceUrl === "string" && sourceUrl.includes("/en/"),
    )
  );
}

export function getFilesToRemoveAfterImport(entries, importedFile, { prune = false } = {}) {
  const frontmatterEntries = entries.map((entry) => entry.frontmatter);

  if (!prune && isAllowedTransitionalDuplicate(frontmatterEntries)) {
    return [];
  }

  return entries.map((entry) => entry.file).filter((file) => file !== importedFile);
}
