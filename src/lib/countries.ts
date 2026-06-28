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

export function isCountryValue(value?: string) {
  return Boolean(value && !NON_COUNTRY_VALUES.has(value));
}
