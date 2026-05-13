# Последнее слово: dashboard

Readonly-зеркало материалов сайта “Последнее слово” для GitHub Pages.

Сайт собирается Astro в полностью статичный HTML. Редактирование остается в WordPress,
а этот репозиторий нужен для быстрого просмотра текстов и будущих инструментов анализа.

## Что уже есть

- Главная страница со сводкой.
- Страница `/words/` со списком, поиском, фильтром по городу и сортировкой.
- Динамические страницы отдельных последних слов.
- Контент в `src/content/last-words/`, валидируемый Astro Content Collections.
- Два шага импорта: сначала сохранить JSON из WordPress, затем сгенерировать Markdown-файлы.

## Ближайшие шаги

1. Довести импорт-скрипт до полного набора записей.
2. Добавить извлечение суда, города и даты произнесения из текста или ручных полей.
3. Добавить страницы статистики, проверки орфографии и отчетов по качеству данных.
4. Описать модель переводов и связанных слов.

## Команды

Все команды запускаются из корня проекта:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Установить зависимости                           |
| `npm run dev`             | Запустить локальный dev server                   |
| `npm run build`           | Собрать статичный сайт в `./dist/`               |
| `npm run preview`         | Проверить production-сборку локально             |
| `npm run fetch:wp`        | Сохранить JSON из WordPress REST API             |
| `npm run import:wp`       | Сгенерировать Markdown из локального JSON        |

В GitHub Pages проект ожидает base path `/final-statement`, он задан в `astro.config.mjs`.

Примеры импорта:

```sh
npm run fetch:wp -- --limit 20 --output data/wp-export/posts.latest.raw.json
npm run import:wp -- --input data/wp-export/posts.latest.raw.json --limit 20
npm run import:wp -- --input data/wp-samples/posts.latest-20.raw.json --limit 20
npm run import:wp -- --input data/wp-samples/posts.latest-20.raw.json --limit 2 --dry-run
```

Обычная разработка должна использовать `import:wp` с локальным JSON, чтобы не дергать WordPress
и Deflect при каждом тесте.
