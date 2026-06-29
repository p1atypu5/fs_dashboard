import type { DisplayWord } from "./lastWords";

export type OriginalLanguageReason = {
  source: "frontmatter" | "text-marker";
  label: string;
  evidence: string;
};

export type OriginalLanguageDetection = {
  language: string;
  languageLabel: string;
  reasons: OriginalLanguageReason[];
  hasConflict: boolean;
};

const languageByRussianAdjective: Record<string, { code: string; label: string }> = {
  английском: { code: "en", label: "английский" },
  арабском: { code: "ar", label: "арабский" },
  азербайджанском: { code: "az", label: "азербайджанский" },
  беларуском: { code: "be", label: "беларусский" },
  беларускай: { code: "be", label: "беларусский" },
  белорусском: { code: "be", label: "беларусский" },
  грузинском: { code: "ka", label: "грузинский" },
  ингушском: { code: "inh", label: "ингушский" },
  казахском: { code: "kk", label: "казахский" },
  каракалпакском: { code: "kaa", label: "каракалпакский" },
  киргизском: { code: "ky", label: "кыргызский" },
  крымскотатарском: { code: "crh", label: "крымскотатарский" },
  кыргызском: { code: "ky", label: "кыргызский" },
  татарском: { code: "tt", label: "татарский" },
  украинском: { code: "uk", label: "украинский" },
  узбекском: { code: "uz", label: "узбекский" },
};

const languageLabels: Record<string, string> = {
  ar: "арабский",
  az: "азербайджанский",
  be: "беларусский",
  crh: "крымскотатарский",
  en: "английский",
  inh: "ингушский",
  ka: "грузинский",
  kaa: "каракалпакский",
  kk: "казахский",
  ky: "кыргызский",
  ru: "русский",
  tt: "татарский",
  uk: "украинский",
  uz: "узбекский",
};

const originalLanguagePatterns = [
  {
    label: "маркер: оригинал последнего слова на языке",
    pattern: /оригинал\s+последнего\s+слова\s+на\s+([а-яё-]+)\s+языке/i,
  },
  {
    label: "маркер: последнее слово в оригинале на языке",
    pattern: /последнее\s+слово\s+в\s+оригинале\s+на\s+([а-яёіўў-]+)\s+языке/i,
  },
  {
    label: "маркер: последнее слово в оригинале на мове",
    pattern: /последнее\s+слово\s+в\s+оригинале\s+на\s+([а-яёіўў-]+)\s+мове/i,
  },
  {
    label: "маркер: последнее слово было произнесено на языке",
    pattern: /последнее\s+слово\s+было\s+произнесено\s+на\s+([а-яёіўў-]+)\s+языке/i,
  },
  {
    label: "маркер: на мове",
    pattern: /(?:^|\s)на\s+([а-яёіўў-]+)\s+мове\s*:?\s*$/i,
  },
  {
    label: "маркер: гаворка на мове",
    pattern: /гаворка[\s\S]{0,80}\s+на\s+([а-яёіўў-]+)\s+мове/i,
  },
];

export function detectOriginalLanguage(word: DisplayWord): OriginalLanguageDetection | undefined {
  const reasonsByLanguage = new Map<string, OriginalLanguageReason[]>();

  if (word.originalLanguage !== word.language) {
    addReason(reasonsByLanguage, word.originalLanguage, {
      source: "frontmatter",
      label: "поле originalLanguage отличается от language",
      evidence: `language: ${word.language}, originalLanguage: ${word.originalLanguage}`,
    });
  }

  for (const block of extractTextBlocks(word.text)) {
    for (const { label, pattern } of originalLanguagePatterns) {
      const match = block.match(pattern);

      if (!match?.[1]) {
        continue;
      }

      const language = parseRussianLanguageAdjective(match[1]);

      if (!language || language.code === word.language) {
        continue;
      }

      addReason(reasonsByLanguage, language.code, {
        source: "text-marker",
        label,
        evidence: block,
      });
    }
  }

  if (reasonsByLanguage.size === 0) {
    return undefined;
  }

  const [language, reasons] = [...reasonsByLanguage.entries()].sort(
    ([leftLanguage], [rightLanguage]) =>
      leftLanguage === word.originalLanguage
        ? -1
        : rightLanguage === word.originalLanguage
          ? 1
          : leftLanguage.localeCompare(rightLanguage),
  )[0];

  return {
    language,
    languageLabel: languageLabels[language] ?? language,
    reasons,
    hasConflict: reasonsByLanguage.size > 1,
  };
}

function addReason(
  reasonsByLanguage: Map<string, OriginalLanguageReason[]>,
  language: string,
  reason: OriginalLanguageReason,
) {
  reasonsByLanguage.set(language, [
    ...(reasonsByLanguage.get(language) ?? []),
    reason,
  ]);
}

function parseRussianLanguageAdjective(value: string) {
  return languageByRussianAdjective[normalizeText(value)];
}

function extractTextBlocks(html: string) {
  const blocks = [...html.matchAll(/<(h[1-6]|p)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => stripHtml(match[2]))
    .filter(Boolean);

  return blocks.length > 0 ? blocks : [stripHtml(html)].filter(Boolean);
}

function stripHtml(value: string) {
  return normalizeText(
    value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'"),
  );
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}
