const russianDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const russianMonthFormatter = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});

const russianMonthsByNumber: Record<string, { nominative: string; genitive: string }> = {
  "01": { nominative: "январь", genitive: "января" },
  "02": { nominative: "февраль", genitive: "февраля" },
  "03": { nominative: "март", genitive: "марта" },
  "04": { nominative: "апрель", genitive: "апреля" },
  "05": { nominative: "май", genitive: "мая" },
  "06": { nominative: "июнь", genitive: "июня" },
  "07": { nominative: "июль", genitive: "июля" },
  "08": { nominative: "август", genitive: "августа" },
  "09": { nominative: "сентябрь", genitive: "сентября" },
  "10": { nominative: "октябрь", genitive: "октября" },
  "11": { nominative: "ноябрь", genitive: "ноября" },
  "12": { nominative: "декабрь", genitive: "декабря" },
};

export function formatRussianDate(value: string) {
  const monthMatch = value.match(/^(\d{4})-(\d{2})$/);

  if (monthMatch) {
    const [, year, month] = monthMatch;
    return russianMonthFormatter.format(new Date(Date.UTC(Number(year), Number(month) - 1, 1)));
  }

  return russianDateFormatter.format(new Date(value));
}

export function formatRussianTableDate(value: string) {
  const monthMatch = value.match(/^(\d{4})-(\d{2})$/);

  if (monthMatch) {
    const [, year, month] = monthMatch;
    const monthName = russianMonthsByNumber[month]?.nominative;
    return monthName ? `${year}, ${monthName}` : formatRussianDate(value);
  }

  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!dateMatch) {
    return formatRussianDate(value);
  }

  const [, year, month, day] = dateMatch;
  const monthName = russianMonthsByNumber[month]?.genitive;

  return monthName ? `${year}, ${day} ${monthName}` : formatRussianDate(value);
}
